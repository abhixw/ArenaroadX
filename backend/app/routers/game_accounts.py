from typing import Any

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_admin, require_user
from app.models.user import User
from app.schemas.common import DataResponse, ListResponse
from app.schemas.game_account import GameAccountResponse, GameAccountUpsert
from app.services import game_account_service

router = APIRouter(prefix="/api/tournaments", tags=["game-accounts"])
my_accounts_router = APIRouter(prefix="/api/my-game-accounts", tags=["game-accounts"])
admin_router = APIRouter(
    prefix="/api/admin/game-accounts", tags=["admin:game-accounts"], dependencies=[Depends(require_admin)]
)


@router.post(
    "/{tournament_id}/game-account",
    response_model=DataResponse[GameAccountResponse],
    summary="Create or update the game account (Game UID) used to register for this tournament's game",
)
async def upsert_game_account(
    tournament_id: PydanticObjectId,
    payload: GameAccountUpsert,
    current_user: User = Depends(require_user),
) -> DataResponse[GameAccountResponse]:
    account = await game_account_service.upsert_for_tournament(
        user_id=current_user.id, tournament_id=tournament_id, payload=payload
    )
    return DataResponse(data=GameAccountResponse.model_validate(account, from_attributes=True))


@router.post(
    "/{tournament_id}/game-account/verify",
    response_model=DataResponse[GameAccountResponse],
    summary="Verify the saved game account against its provider (e.g. Chess.com), if this tournament's game supports it",
)
async def verify_game_account(
    tournament_id: PydanticObjectId,
    current_user: User = Depends(require_user),
) -> DataResponse[GameAccountResponse]:
    account = await game_account_service.verify_game_account(user_id=current_user.id, tournament_id=tournament_id)
    return DataResponse(data=GameAccountResponse.model_validate(account, from_attributes=True))


@my_accounts_router.get(
    "", response_model=ListResponse[GameAccountResponse], summary="List the current user's game accounts"
)
async def list_my_game_accounts(current_user: User = Depends(require_user)) -> ListResponse[GameAccountResponse]:
    accounts = await game_account_service.list_my_game_accounts(current_user.id)
    return ListResponse(data=[GameAccountResponse.model_validate(a, from_attributes=True) for a in accounts])


@my_accounts_router.post(
    "/{game_id}",
    response_model=DataResponse[GameAccountResponse],
    summary="Create or update the game account (Game UID) for a game, outside of a specific tournament's flow",
)
async def upsert_my_game_account(
    game_id: PydanticObjectId,
    payload: GameAccountUpsert,
    current_user: User = Depends(require_user),
) -> DataResponse[GameAccountResponse]:
    account = await game_account_service.upsert_for_game(user_id=current_user.id, game_id=game_id, payload=payload)
    return DataResponse(data=GameAccountResponse.model_validate(account, from_attributes=True))


@admin_router.get(
    "/{game_account_id}/provider-stats",
    response_model=DataResponse[dict],
    summary="Fetch the linked account's live stats from its provider (admin only; e.g. Chess.com ratings/record)",
)
async def get_provider_stats(game_account_id: PydanticObjectId) -> DataResponse[dict[str, Any]]:
    stats = await game_account_service.get_provider_stats(game_account_id)
    return DataResponse(data=stats)


@admin_router.get(
    "/{game_account_id}/provider-archive-periods",
    response_model=DataResponse[list[str]],
    summary="List the archive periods (e.g. '2026/06') available for a linked account (admin only)",
)
async def get_provider_archive_periods(game_account_id: PydanticObjectId) -> DataResponse[list[str]]:
    periods = await game_account_service.get_provider_archive_periods(game_account_id)
    return DataResponse(data=periods)


@admin_router.get(
    "/{game_account_id}/provider-games",
    response_model=DataResponse[list[dict]],
    summary="Fetch a linked account's real games for one period, to cross-check a claimed tournament result (admin only)",
)
async def get_provider_games(
    game_account_id: PydanticObjectId, period: str = Query(..., description="e.g. 2026/06")
) -> DataResponse[list[dict[str, Any]]]:
    games = await game_account_service.get_provider_games(game_account_id, period)
    return DataResponse(data=games)
