from decimal import Decimal

from beanie import PydanticObjectId

from app.core.exceptions import AppError, GameNotFoundError, InvalidTournamentStatusError, TournamentNotFoundError
from app.models.tournament import Tournament, TournamentStatus
from app.repositories import game_repository, tournament_repository
from app.schemas.tournament import TournamentCreate, TournamentResponse, TournamentUpdate

# DRAFT -> REGISTRATION_OPEN -> REGISTRATION_CLOSED -> READY -> LIVE -> RESULTS_PENDING ->
# RESULTS_REVIEW -> RESULTS_PUBLISHED -> COMPLETED, with CANCELLED reachable from any
# non-terminal, non-published state. Matches the revised spec's lifecycle (section 3).
ALLOWED_TRANSITIONS: dict[TournamentStatus, set[TournamentStatus]] = {
    TournamentStatus.DRAFT: {TournamentStatus.REGISTRATION_OPEN, TournamentStatus.CANCELLED},
    TournamentStatus.REGISTRATION_OPEN: {TournamentStatus.REGISTRATION_CLOSED, TournamentStatus.CANCELLED},
    TournamentStatus.REGISTRATION_CLOSED: {TournamentStatus.READY, TournamentStatus.CANCELLED},
    TournamentStatus.READY: {TournamentStatus.LIVE, TournamentStatus.CANCELLED},
    TournamentStatus.LIVE: {TournamentStatus.RESULTS_PENDING, TournamentStatus.CANCELLED},
    TournamentStatus.RESULTS_PENDING: {TournamentStatus.RESULTS_REVIEW, TournamentStatus.CANCELLED},
    TournamentStatus.RESULTS_REVIEW: {TournamentStatus.RESULTS_PUBLISHED, TournamentStatus.CANCELLED},
    TournamentStatus.RESULTS_PUBLISHED: {TournamentStatus.COMPLETED},
    TournamentStatus.COMPLETED: set(),
    TournamentStatus.CANCELLED: set(),
}

_PAISE_PER_RUPEE = 100


def _to_paise(rupees: Decimal) -> int:
    return int(rupees * _PAISE_PER_RUPEE)


def _to_rupees(paise: int) -> Decimal:
    return Decimal(paise) / _PAISE_PER_RUPEE


def _to_rupees_optional(paise: int | None) -> Decimal | None:
    return _to_rupees(paise) if paise is not None else None


def _to_paise_optional(rupees: Decimal | None) -> int | None:
    return _to_paise(rupees) if rupees is not None else None


def to_response(tournament: Tournament) -> TournamentResponse:
    return TournamentResponse(
        id=tournament.id,
        game_id=tournament.game_id,
        name=tournament.name,
        description=tournament.description,
        entry_fee=_to_rupees(tournament.entry_fee_paise),
        prize_pool=_to_rupees(tournament.prize_pool_paise),
        first_prize=_to_rupees_optional(tournament.first_prize_paise),
        second_prize=_to_rupees_optional(tournament.second_prize_paise),
        max_players=tournament.max_players,
        registered_players=tournament.reserved_slots,
        start_time=tournament.start_time,
        registration_deadline=tournament.registration_deadline,
        game_url=tournament.game_url,
        rules=tournament.rules,
        instructions=tournament.instructions,
        status=tournament.status,
        cancellation_reason=tournament.cancellation_reason,
        created_at=tournament.created_at,
        updated_at=tournament.updated_at,
    )


async def list_tournaments(
    *, game_id: PydanticObjectId | None = None, status: TournamentStatus | None = None
) -> list[Tournament]:
    return await tournament_repository.list_all(game_id=game_id, status=status)


async def list_upcoming_tournaments() -> list[Tournament]:
    return await tournament_repository.list_upcoming()


async def get_tournament(tournament_id: PydanticObjectId) -> Tournament:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    return tournament


async def create_tournament(payload: TournamentCreate) -> Tournament:
    game = await game_repository.get_by_id(payload.game_id)
    if game is None:
        raise GameNotFoundError()

    data = payload.model_dump(exclude={"entry_fee", "prize_pool", "first_prize", "second_prize", "game_url"})
    data["entry_fee_paise"] = _to_paise(payload.entry_fee)
    data["prize_pool_paise"] = _to_paise(payload.prize_pool)
    data["first_prize_paise"] = _to_paise_optional(payload.first_prize)
    data["second_prize_paise"] = _to_paise_optional(payload.second_prize)
    data["game_url"] = str(payload.game_url) if payload.game_url else None

    return await tournament_repository.create(**data)


def _apply_status_transition(tournament: Tournament, target_status: TournamentStatus) -> None:
    if target_status == tournament.status:
        return
    allowed = ALLOWED_TRANSITIONS.get(tournament.status, set())
    if target_status not in allowed:
        raise InvalidTournamentStatusError(
            f"Cannot transition tournament from {tournament.status.value} to {target_status.value}."
        )
    tournament.status = target_status


async def update_tournament(tournament_id: PydanticObjectId, payload: TournamentUpdate) -> Tournament:
    tournament = await get_tournament(tournament_id)

    updates = payload.model_dump(
        exclude_unset=True, exclude={"status", "entry_fee", "prize_pool", "first_prize", "second_prize", "game_url"}
    )

    if "game_id" in updates:
        game = await game_repository.get_by_id(updates["game_id"])
        if game is None:
            raise GameNotFoundError()

    if payload.entry_fee is not None:
        updates["entry_fee_paise"] = _to_paise(payload.entry_fee)
    if payload.prize_pool is not None:
        updates["prize_pool_paise"] = _to_paise(payload.prize_pool)
    if "first_prize" in payload.model_fields_set:
        updates["first_prize_paise"] = _to_paise_optional(payload.first_prize)
    if "second_prize" in payload.model_fields_set:
        updates["second_prize_paise"] = _to_paise_optional(payload.second_prize)
    if "game_url" in payload.model_fields_set:
        updates["game_url"] = str(payload.game_url) if payload.game_url else None

    new_start_time = updates.get("start_time", tournament.start_time)
    new_deadline = updates.get("registration_deadline", tournament.registration_deadline)
    if new_deadline >= new_start_time:
        raise AppError(
            "registration_deadline must be before start_time.", error_code="VALIDATION_ERROR", status_code=400
        )

    for key, value in updates.items():
        setattr(tournament, key, value)

    if payload.status is not None:
        _apply_status_transition(tournament, payload.status)

    await tournament.save()
    return tournament


async def transition_status(tournament_id: PydanticObjectId, target_status: TournamentStatus) -> Tournament:
    tournament = await get_tournament(tournament_id)
    _apply_status_transition(tournament, target_status)
    await tournament.save()
    return tournament


async def open_registration(tournament_id: PydanticObjectId) -> Tournament:
    return await transition_status(tournament_id, TournamentStatus.REGISTRATION_OPEN)


async def close_registration(tournament_id: PydanticObjectId) -> Tournament:
    return await transition_status(tournament_id, TournamentStatus.REGISTRATION_CLOSED)


async def mark_ready(tournament_id: PydanticObjectId) -> Tournament:
    return await transition_status(tournament_id, TournamentStatus.READY)


async def start_tournament(tournament_id: PydanticObjectId) -> Tournament:
    return await transition_status(tournament_id, TournamentStatus.LIVE)


async def end_tournament(tournament_id: PydanticObjectId) -> Tournament:
    return await transition_status(tournament_id, TournamentStatus.RESULTS_PENDING)


async def cancel_tournament(tournament_id: PydanticObjectId, reason: str) -> Tournament:
    tournament = await get_tournament(tournament_id)
    _apply_status_transition(tournament, TournamentStatus.CANCELLED)
    tournament.cancellation_reason = reason
    await tournament.save()
    return tournament
