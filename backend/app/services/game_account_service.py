from datetime import datetime, timezone

from beanie import PydanticObjectId

from app.core.exceptions import (
    GameAccountLockedError,
    GameAccountRequiredError,
    GameNotFoundError,
    GameUidAlreadyClaimedError,
    IntegrationNotSupportedError,
    IntegrationUnavailableError as AppIntegrationUnavailableError,
    ProviderPlayerNotFoundError,
    TournamentNotFoundError,
)
from app.integrations import get_integration
from app.integrations.base import IntegrationUnavailableError, PlayerNotFoundError
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


def _reset_verification_if_uid_changed(existing: GameAccount, new_uid: str) -> dict:
    """A verified profile snapshot is only meaningful for the UID it was fetched for --
    changing the UID must not leave the old provider data looking like it still applies."""
    if existing.game_uid == new_uid:
        return {}
    return {"verified_at": None, "provider_player_id": None, "provider_data": {}}


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
            existing,
            game_uid=payload.game_uid,
            game_username=payload.game_username,
            **_reset_verification_if_uid_changed(existing, payload.game_uid),
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
            existing,
            game_uid=payload.game_uid,
            game_username=payload.game_username,
            **_reset_verification_if_uid_changed(existing, payload.game_uid),
        )

    return await game_account_repository.create(
        user_id=user_id, game_id=game_id, game_uid=payload.game_uid, game_username=payload.game_username
    )


async def verify_game_account(*, user_id: PydanticObjectId, tournament_id: PydanticObjectId) -> GameAccount:
    """Confirms the user's saved game_uid is a real account on the game's provider (e.g.
    Chess.com), fetching and storing a snapshot of the provider's public profile. Only
    supported for games with an integration_key -- see app.integrations."""
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()

    game = await game_repository.get_by_id(tournament.game_id)
    if game is None or not game.integration_key:
        raise IntegrationNotSupportedError()

    integration = get_integration(game.integration_key)
    if integration is None:
        raise IntegrationNotSupportedError()

    account = await game_account_repository.get_by_user_and_game(user_id, tournament.game_id)
    if account is None:
        raise GameAccountRequiredError()

    try:
        profile = await integration.verify_account(account.game_uid)
    except PlayerNotFoundError as exc:
        raise ProviderPlayerNotFoundError() from exc
    except IntegrationUnavailableError as exc:
        raise AppIntegrationUnavailableError() from exc

    return await game_account_repository.update(
        account,
        verified_at=datetime.now(timezone.utc),
        provider_player_id=profile.provider_player_id,
        provider_data=profile.raw,
        game_username=profile.display_name or account.game_username,
    )


async def _get_verified_account_and_integration(game_account_id: PydanticObjectId):
    account = await game_account_repository.get_by_id(game_account_id)
    if account is None:
        raise GameAccountRequiredError()

    game = await game_repository.get_by_id(account.game_id)
    if game is None or not game.integration_key:
        raise IntegrationNotSupportedError()

    integration = get_integration(game.integration_key)
    if integration is None:
        raise IntegrationNotSupportedError()

    return account, integration


async def get_provider_stats(game_account_id: PydanticObjectId) -> dict:
    """Admin tooling: the provider's own stats (ratings, W/L record, etc.) for a linked
    account -- helps sanity-check a claimed result against the player's real activity."""
    account, integration = await _get_verified_account_and_integration(game_account_id)
    try:
        return await integration.get_stats(account.game_uid)
    except PlayerNotFoundError as exc:
        raise ProviderPlayerNotFoundError() from exc
    except IntegrationUnavailableError as exc:
        raise AppIntegrationUnavailableError() from exc


async def get_provider_archive_periods(game_account_id: PydanticObjectId) -> list[str]:
    account, integration = await _get_verified_account_and_integration(game_account_id)
    try:
        return await integration.list_archive_periods(account.game_uid)
    except PlayerNotFoundError as exc:
        raise ProviderPlayerNotFoundError() from exc
    except IntegrationUnavailableError as exc:
        raise AppIntegrationUnavailableError() from exc


async def get_provider_games(game_account_id: PydanticObjectId, period: str) -> list[dict]:
    """Admin tooling: the player's real games for one archive period (e.g. "2026/06") --
    used to identify/cross-check a tournament match result rather than trusting a manual
    claim alone. Never written to the results system automatically; an admin still enters
    the result themselves, same as every other game on this platform."""
    account, integration = await _get_verified_account_and_integration(game_account_id)
    try:
        return await integration.get_games_for_period(account.game_uid, period)
    except PlayerNotFoundError as exc:
        raise ProviderPlayerNotFoundError() from exc
    except IntegrationUnavailableError as exc:
        raise AppIntegrationUnavailableError() from exc
