from beanie import PydanticObjectId

from app.core.database import session_client
from app.core.exceptions import (
    MatchNotFoundError,
    MatchResultAlreadyExistsError,
    MatchResultNotFoundError,
    ResultAlreadyPublishedError,
    ScoringRuleNotConfiguredError,
    TournamentNotFoundError,
    UnregisteredGameUidError,
)
from app.models.match_participant import MatchParticipationStatus
from app.models.match_result import MatchResult, MatchResultStatus
from app.models.prize import PrizePayoutStatus
from app.models.result_revision import ResultRevision
from app.models.tournament import TournamentStatus
from app.models.tournament_result import TournamentResult, TournamentResultStatus
from app.repositories import (
    match_participant_repository,
    match_repository,
    match_result_repository,
    prize_repository,
    result_revision_repository,
    scoring_rule_repository,
    tournament_repository,
    tournament_result_repository,
)
from app.schemas.result import MatchResultCorrection, MatchResultCreate, MatchResultUpdate
from app.schemas.scoring_rule import ScoringRuleUpsert
from app.services import scoring_service, tournament_service


async def upsert_scoring_rule(tournament_id: PydanticObjectId, payload: ScoringRuleUpsert):
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    return await scoring_rule_repository.create_new_version(tournament_id, **payload.model_dump())


async def get_active_scoring_rule(tournament_id: PydanticObjectId):
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    rule = await scoring_rule_repository.get_active_for_tournament(tournament_id)
    if rule is None:
        raise ScoringRuleNotConfiguredError()
    return rule


async def recalculate_tournament_result(rule, match_result: MatchResult) -> TournamentResult:
    placement_points, kill_points, bonus_points, total_score = scoring_service.calculate(rule, match_result)
    return await tournament_result_repository.upsert(
        tournament_id=match_result.tournament_id,
        user_id=match_result.user_id,
        match_result_id=match_result.id,
        scoring_rule_id=rule.id,
        scoring_rule_version=rule.version,
        placement_points=placement_points,
        kill_points=kill_points,
        bonus_points=bonus_points,
        total_score=total_score,
        status=TournamentResultStatus.DRAFT,
    )


async def recompute_ranks(tournament_id: PydanticObjectId, rule) -> None:
    all_results = await tournament_result_repository.list_by_tournament(tournament_id)
    match_results_by_user = {mr.user_id: mr for mr in await match_result_repository.list_by_tournament(tournament_id)}

    def _match_result_for(result: TournamentResult):
        return match_results_by_user.get(result.user_id)

    ranked = sorted(
        all_results,
        key=lambda r: scoring_service.sort_key(rule, r.total_score, _match_result_for(r)),
        reverse=True,
    )
    for idx, result in enumerate(ranked, start=1):
        result.rank = idx

    async def _save(session) -> None:
        await tournament_result_repository.save_all(ranked, session=session)

    async with session_client(TournamentResult).start_session() as session:
        await session.with_transaction(_save)


async def enter_match_result(match_id: PydanticObjectId, payload: MatchResultCreate) -> MatchResult:
    match = await match_repository.get_by_id(match_id)
    if match is None:
        raise MatchNotFoundError()

    participants = await match_participant_repository.list_by_match(match_id)
    participant = next((p for p in participants if p.game_uid == payload.game_uid), None)
    if participant is None or participant.participation_status == MatchParticipationStatus.DISQUALIFIED:
        raise UnregisteredGameUidError()

    existing = await match_result_repository.get_by_match_and_user(match_id, participant.user_id)
    if existing is not None:
        raise MatchResultAlreadyExistsError()

    match_result = await match_result_repository.create(
        match_id=match_id,
        tournament_id=match.tournament_id,
        user_id=participant.user_id,
        game_uid=payload.game_uid,
        placement=payload.placement,
        kills=payload.kills,
        raw_data=payload.raw_data,
        source="ADMIN_MANUAL",
        evidence_reference=payload.evidence_reference,
        status=MatchResultStatus.VALIDATED,
    )

    rule = await get_active_scoring_rule(match.tournament_id)
    await recalculate_tournament_result(rule, match_result)
    await recompute_ranks(match.tournament_id, rule)
    return match_result


async def list_match_results(match_id: PydanticObjectId) -> list[MatchResult]:
    match = await match_repository.get_by_id(match_id)
    if match is None:
        raise MatchNotFoundError()
    return await match_result_repository.list_by_match(match_id)


async def update_match_result(match_result_id: PydanticObjectId, payload: MatchResultUpdate) -> MatchResult:
    match_result = await match_result_repository.get_by_id(match_result_id)
    if match_result is None:
        raise MatchResultNotFoundError()

    # Published results are locked against casual edits (spec section 13/14) -- once
    # published, changes must go through correct_result() so they're audited.
    tournament_result = await tournament_result_repository.get_by_tournament_and_user(
        match_result.tournament_id, match_result.user_id
    )
    if tournament_result is not None and tournament_result.status == TournamentResultStatus.PUBLISHED:
        raise ResultAlreadyPublishedError()

    updates = payload.model_dump(exclude_unset=True)
    match_result = await match_result_repository.update(match_result, **updates)

    rule = await get_active_scoring_rule(match_result.tournament_id)
    await recalculate_tournament_result(rule, match_result)
    await recompute_ranks(match_result.tournament_id, rule)
    return match_result


async def correct_result(
    match_result_id: PydanticObjectId, payload: MatchResultCorrection, changed_by: PydanticObjectId
) -> tuple[MatchResult, ResultRevision]:
    """The audited path for changing a result that may already be published -- records
    old/new values, who changed it, when, and why (spec section 14)."""
    match_result = await match_result_repository.get_by_id(match_result_id)
    if match_result is None:
        raise MatchResultNotFoundError()

    old_values = {"placement": match_result.placement, "kills": match_result.kills, "raw_data": dict(match_result.raw_data)}
    tournament_result_before = await tournament_result_repository.get_by_tournament_and_user(
        match_result.tournament_id, match_result.user_id
    )
    was_published = tournament_result_before is not None and tournament_result_before.status == TournamentResultStatus.PUBLISHED

    updates = payload.model_dump(exclude_unset=True, exclude={"reason"})
    match_result = await match_result_repository.update(match_result, **updates)

    rule = await get_active_scoring_rule(match_result.tournament_id)
    tournament_result_after = await recalculate_tournament_result(rule, match_result)
    if was_published:
        # A correction to a published result stays published -- it doesn't hide something
        # already visible to users, it fixes it in place.
        tournament_result_after.status = TournamentResultStatus.PUBLISHED
        await tournament_result_after.save()
    await recompute_ranks(match_result.tournament_id, rule)
    tournament_result_after = await tournament_result_repository.get_by_id(tournament_result_after.id)

    changes = {
        field: {"old": old_values.get(field), "new": new_value}
        for field, new_value in updates.items()
        if old_values.get(field) != new_value
    }

    # A correction to a result that already had a PAID prize needs a human to look at it --
    # the payout may now be wrong, but we never reverse money automatically.
    existing_prize = await prize_repository.get_by_tournament_and_user(match_result.tournament_id, match_result.user_id)
    financial_impact_flagged = existing_prize is not None and existing_prize.payout_status == PrizePayoutStatus.PAID

    revision = await result_revision_repository.create(
        tournament_id=match_result.tournament_id,
        match_result_id=match_result.id,
        tournament_result_id=tournament_result_after.id,
        user_id=match_result.user_id,
        changed_by=changed_by,
        reason=payload.reason,
        changes=changes,
        old_rank=tournament_result_before.rank if tournament_result_before else None,
        new_rank=tournament_result_after.rank,
        old_total_score=tournament_result_before.total_score if tournament_result_before else None,
        new_total_score=tournament_result_after.total_score,
        financial_impact_flagged=financial_impact_flagged,
    )
    return match_result, revision


async def review_results(tournament_id: PydanticObjectId) -> list[TournamentResult]:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    # Advances the tournament's own lifecycle state too (RESULTS_PENDING -> RESULTS_REVIEW),
    # not just the per-result status -- these two state machines must move together.
    async def _review(session) -> None:
        await tournament_service.transition_status(tournament_id, TournamentStatus.RESULTS_REVIEW, session=session)
        await tournament_result_repository.bulk_update_status(
            tournament_id, TournamentResultStatus.DRAFT, TournamentResultStatus.APPROVED, session=session
        )

    async with session_client(TournamentResult).start_session() as session:
        await session.with_transaction(_review)
    return await tournament_result_repository.list_by_tournament(tournament_id)


async def publish_results(tournament_id: PydanticObjectId) -> list[TournamentResult]:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    async def _publish(session) -> None:
        await tournament_service.transition_status(
            tournament_id, TournamentStatus.RESULTS_PUBLISHED, session=session
        )
        await tournament_result_repository.bulk_update_status(
            tournament_id, TournamentResultStatus.APPROVED, TournamentResultStatus.PUBLISHED, session=session
        )

    async with session_client(TournamentResult).start_session() as session:
        await session.with_transaction(_publish)
    return await tournament_result_repository.list_by_tournament(tournament_id)


async def list_published_results(tournament_id: PydanticObjectId) -> list[TournamentResult]:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    return await tournament_result_repository.list_published_by_tournament(tournament_id)
