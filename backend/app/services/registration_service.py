from datetime import datetime, timedelta, timezone

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.database import session_client
from app.core.exceptions import (
    AccountNotActiveError,
    AdminCannotRegisterError,
    AlreadyRegisteredError,
    GameAccountRequiredError,
    RegistrationDeadlinePassedError,
    RegistrationNotFoundError,
    TournamentClosedError,
    TournamentFullError,
    TournamentNotFoundError,
    UserNotFoundError,
)
from app.models.registration import Registration, RegistrationStatus
from app.models.tournament import TournamentStatus
from app.models.user import User, UserRole, UserStatus
from app.repositories import game_account_repository, registration_repository, tournament_repository, user_repository


async def _sweep_expired_reservations(tournament_id: PydanticObjectId) -> None:
    """No background worker in this MVP, so stale PENDING_PAYMENT reservations are
    expired lazily, right before a new registration attempt needs accurate capacity."""
    expired = await registration_repository.list_expired_pending(tournament_id)
    for registration in expired:
        async with session_client(Registration).start_session() as session:
            async with await session.start_transaction():
                registration.registration_status = RegistrationStatus.EXPIRED
                await registration.save(session=session)
                await registration_repository.release_slot(tournament_id, session=session)


async def register_for_tournament(*, user_id: PydanticObjectId, tournament_id: PydanticObjectId) -> Registration:
    user = await user_repository.get_by_id(user_id)
    if user is None:
        raise UserNotFoundError()
    if user.status != UserStatus.ACTIVE:
        raise AccountNotActiveError()
    # An admin who is also a confirmed participant would have unilateral power over that
    # tournament's own results and prize payouts -- a conflict of interest, not just an
    # odd-looking entry in the Participants tab.
    if user.role == UserRole.ADMIN:
        raise AdminCannotRegisterError()

    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    if tournament.status != TournamentStatus.REGISTRATION_OPEN:
        raise TournamentClosedError()
    if datetime.now(timezone.utc) >= tournament.registration_deadline:
        raise RegistrationDeadlinePassedError()

    existing = await registration_repository.get_active_by_user_and_tournament(user_id, tournament_id)
    if existing is not None:
        raise AlreadyRegisteredError()

    game_account = await game_account_repository.get_by_user_and_game(user_id, tournament.game_id)
    if game_account is None:
        raise GameAccountRequiredError()

    await _sweep_expired_reservations(tournament_id)

    # Atomic conditional increment: this is what actually prevents overbooking under
    # concurrency (MongoDB has no SELECT ... FOR UPDATE) -- see registration_repository.reserve_slot.
    reserved = await registration_repository.reserve_slot(tournament_id)
    if not reserved:
        raise TournamentFullError()

    reserved_until = datetime.now(timezone.utc) + timedelta(minutes=settings.REGISTRATION_RESERVATION_MINUTES)
    try:
        return await registration_repository.create(
            user_id=user_id,
            tournament_id=tournament_id,
            game_account_id=game_account.id,
            game_uid=game_account.game_uid,
            game_username=game_account.game_username,
            reserved_until=reserved_until,
        )
    except DuplicateKeyError:
        # The partial unique index caught a race we didn't -- release the slot we just took.
        await registration_repository.release_slot(tournament_id)
        raise AlreadyRegisteredError()


async def list_my_tournaments(user_id: PydanticObjectId) -> list[Registration]:
    return await registration_repository.list_by_user(user_id)


async def get_my_tournament(*, user_id: PydanticObjectId, tournament_id: PydanticObjectId) -> Registration:
    registration = await registration_repository.get_latest_by_user_and_tournament(user_id, tournament_id)
    if registration is None:
        raise RegistrationNotFoundError()
    return registration


async def list_tournament_participants(tournament_id: PydanticObjectId) -> list[Registration]:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    return await registration_repository.list_confirmed_by_tournament(tournament_id)


async def get_player_history(user_id: PydanticObjectId) -> tuple[User, list[Registration]]:
    user = await user_repository.get_by_id(user_id)
    if user is None:
        raise UserNotFoundError()
    registrations = await registration_repository.list_by_user(user_id)
    return user, registrations


async def disqualify_registration(registration_id: PydanticObjectId, reason: str) -> Registration:
    registration = await registration_repository.get_by_id(registration_id)
    if registration is None:
        raise RegistrationNotFoundError()

    was_active = registration.registration_status in (RegistrationStatus.PENDING_PAYMENT, RegistrationStatus.CONFIRMED)
    registration = await registration_repository.update(
        registration,
        registration_status=RegistrationStatus.DISQUALIFIED,
        disqualification_reason=reason,
    )
    if was_active:
        await registration_repository.release_slot(registration.tournament_id)
    return registration
