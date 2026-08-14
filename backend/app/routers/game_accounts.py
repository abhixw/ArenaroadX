from beanie import PydanticObjectId
from fastapi import APIRouter, Depends

from app.core.dependencies import require_user
from app.models.user import User
from app.schemas.common import DataResponse, ListResponse
from app.schemas.game_account import GameAccountResponse, GameAccountUpsert
from app.services import game_account_service

router = APIRouter(prefix="/api/tournaments", tags=["game-accounts"])
my_accounts_router = APIRouter(prefix="/api/my-game-accounts", tags=["game-accounts"])


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
