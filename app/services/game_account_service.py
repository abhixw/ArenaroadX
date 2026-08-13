from beanie import PydanticObjectId

from app.core.exceptions import (
    GameAccountLockedError,
    GameNotFoundError,
    GameUidAlreadyClaimedError,
    TournamentNotFoundError,
)
from app.models.game_account import GameAccount
from app.models.registration import ACTIVE_REGISTRATION_STATUSES
from app.models.tournament import TournamentStatus
from app.repositories import game_account_repository, game_repository, registration_repository, tournament_repository
from app.schemas.game_account import GameAccountUpsert

# Once the user's registration for a specific tournament has moved past these states,
# that tournament's game identity is locked (spec: "cannot silently change the Game UID
# after registration closes").
_UNLOCKED_TOURNAMENT_STATUSES = {TournamentStatus.DRAFT, TournamentStatus.REGISTRATION_OPEN}


async def list_my_game_accounts(user_id: PydanticObjectId) -> list[GameAccount]:
    return await game_account_repository.list_by_user(user_id)


async def upsert_for_tournament(
    *, user_id: PydanticObjectId, tournament_id: PydanticObjectId, payload: GameAccountUpsert
) -> GameAccount:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()

    existing = await game_account_repository.get_by_user_and_game(user_id, tournament.game_id)

    if existing is not None and existing.game_uid != payload.game_uid:
        active_registration = await registration_repository.get_active_by_user_and_tournament(
            user_id, tournament_id
        )
        if active_registration is not None and tournament.status not in _UNLOCKED_TOURNAMENT_STATUSES:
            raise GameAccountLockedError()

    uid_owner = await game_account_repository.get_by_game_and_uid(tournament.game_id, payload.game_uid)
    if uid_owner is not None and (existing is None or uid_owner.id != existing.id):
        raise GameUidAlreadyClaimedError()

    if existing is not None:
        return await game_account_repository.update(
            existing, game_uid=payload.game_uid, game_username=payload.game_username
        )

    return await game_account_repository.create(
        user_id=user_id, game_id=tournament.game_id, game_uid=payload.game_uid, game_username=payload.game_username
    )


async def upsert_for_game(
    *, user_id: PydanticObjectId, game_id: PydanticObjectId, payload: GameAccountUpsert
) -> GameAccount:
    """Same as upsert_for_tournament, but for the standalone Game Accounts management screen
    (not tied to a single in-progress registration). Locked if the game_uid is changing and
    the user has any active registration, for *any* tournament of this game, that's past the
    unlocked statuses."""
    game = await game_repository.get_by_id(game_id)
    if game is None:
        raise GameNotFoundError()

    existing = await game_account_repository.get_by_user_and_game(user_id, game_id)

    if existing is not None and existing.game_uid != payload.game_uid:
        active_registrations = [
            r
            for r in await registration_repository.list_by_user(user_id)
            if r.registration_status in ACTIVE_REGISTRATION_STATUSES
        ]
        for registration in active_registrations:
            tournament = await tournament_repository.get_by_id(registration.tournament_id)
            if (
                tournament is not None
                and tournament.game_id == game_id
                and tournament.status not in _UNLOCKED_TOURNAMENT_STATUSES
            ):
                raise GameAccountLockedError()

    uid_owner = await game_account_repository.get_by_game_and_uid(game_id, payload.game_uid)
    if uid_owner is not None and (existing is None or uid_owner.id != existing.id):
        raise GameUidAlreadyClaimedError()

    if existing is not None:
        return await game_account_repository.update(
            existing, game_uid=payload.game_uid, game_username=payload.game_username
        )

    return await game_account_repository.create(
        user_id=user_id, game_id=game_id, game_uid=payload.game_uid, game_username=payload.game_username
    )
