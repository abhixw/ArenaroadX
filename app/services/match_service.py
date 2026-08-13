from datetime import datetime, timezone

from beanie import PydanticObjectId

from app.core.exceptions import (
    AccessWindowNotOpenError,
    DuplicateMatchNumberError,
    MatchNotFoundError,
    NotAMatchParticipantError,
    TournamentNotFoundError,
)
from app.models.match import Match, MatchStatus
from app.models.match_participant import MatchParticipant, MatchParticipationStatus
from app.models.registration import RegistrationStatus
from app.repositories import match_participant_repository, match_repository, registration_repository, tournament_repository
from app.schemas.match import MatchCreate, MatchUpdate


async def list_matches(tournament_id: PydanticObjectId) -> list[Match]:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    return await match_repository.list_by_tournament(tournament_id)


async def get_match(match_id: PydanticObjectId) -> Match:
    match = await match_repository.get_by_id(match_id)
    if match is None:
        raise MatchNotFoundError()
    return match


async def create_match(tournament_id: PydanticObjectId, payload: MatchCreate) -> Match:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()

    existing = await match_repository.get_by_tournament_and_number(tournament_id, payload.match_number)
    if existing is not None:
        raise DuplicateMatchNumberError()

    match = await match_repository.create(tournament_id=tournament_id, **payload.model_dump())

    # MVP simplification: a match's roster is every currently-confirmed registrant for the
    # tournament (no separate manual per-match roster-curation endpoint -- nothing in the
    # spec's endpoint list calls for one, and this keeps single-match tournaments trivial).
    confirmed = await registration_repository.list_confirmed_by_tournament(tournament_id)
    participants = [
        MatchParticipant(
            match_id=match.id,
            tournament_id=tournament_id,
            user_id=r.user_id,
            game_account_id=r.game_account_id,
            game_uid=r.game_uid,
        )
        for r in confirmed
    ]
    await match_participant_repository.bulk_create(participants)

    return match


async def update_match(match_id: PydanticObjectId, payload: MatchUpdate) -> Match:
    match = await get_match(match_id)
    updates = payload.model_dump(exclude_unset=True)
    return await match_repository.update(match, **updates)


async def start_match(match_id: PydanticObjectId) -> Match:
    match = await get_match(match_id)
    return await match_repository.update(match, status=MatchStatus.LIVE, start_time=datetime.now(timezone.utc))


async def end_match(match_id: PydanticObjectId) -> Match:
    match = await get_match(match_id)
    return await match_repository.update(match, status=MatchStatus.COMPLETED, end_time=datetime.now(timezone.utc))


async def cancel_match(match_id: PydanticObjectId) -> Match:
    match = await get_match(match_id)
    return await match_repository.update(match, status=MatchStatus.CANCELLED)


async def get_match_access(match_id: PydanticObjectId, user_id: PydanticObjectId) -> Match:
    match = await get_match(match_id)

    participant = await match_participant_repository.get_by_match_and_user(match_id, user_id)
    if participant is None:
        # Roster is normally snapshotted at match-creation time (see create_match's
        # docstring), which misses anyone who registers afterward. Lazily join in anyone
        # who's since become a CONFIRMED registrant for this match's tournament, rather than
        # permanently locking them out of a match created before they registered.
        registration = await registration_repository.get_active_by_user_and_tournament(user_id, match.tournament_id)
        if registration is not None and registration.registration_status == RegistrationStatus.CONFIRMED:
            participant = MatchParticipant(
                match_id=match_id,
                tournament_id=match.tournament_id,
                user_id=user_id,
                game_account_id=registration.game_account_id,
                game_uid=registration.game_uid,
            )
            await match_participant_repository.bulk_create([participant])

    if participant is None or participant.participation_status == MatchParticipationStatus.DISQUALIFIED:
        raise NotAMatchParticipantError()

    if datetime.now(timezone.utc) < match.join_window_opens_at:
        raise AccessWindowNotOpenError()

    return match
