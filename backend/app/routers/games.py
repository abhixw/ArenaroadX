from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, status

from app.core.dependencies import require_admin
from app.schemas.common import DataResponse, ListResponse
from app.schemas.game import GameCreate, GameResponse, GameUpdate
from app.services import game_service

router = APIRouter(prefix="/api/games", tags=["games"])
admin_router = APIRouter(prefix="/api/admin/games", tags=["admin:games"], dependencies=[Depends(require_admin)])


@router.get("", response_model=ListResponse[GameResponse], summary="List all games")
async def list_games() -> ListResponse[GameResponse]:
    games = await game_service.list_games()
    return ListResponse(data=[GameResponse.model_validate(g, from_attributes=True) for g in games])


@router.get("/{game_id}", response_model=DataResponse[GameResponse], summary="Get a game by id")
async def get_game(game_id: PydanticObjectId) -> DataResponse[GameResponse]:
    game = await game_service.get_game(game_id)
    return DataResponse(data=GameResponse.model_validate(game, from_attributes=True))


@admin_router.post(
    "",
    response_model=DataResponse[GameResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a game (admin only)",
)
async def create_game(payload: GameCreate) -> DataResponse[GameResponse]:
    game = await game_service.create_game(payload)
    return DataResponse(data=GameResponse.model_validate(game, from_attributes=True))


@admin_router.put("/{game_id}", response_model=DataResponse[GameResponse], summary="Update a game (admin only)")
async def update_game(game_id: PydanticObjectId, payload: GameUpdate) -> DataResponse[GameResponse]:
    game = await game_service.update_game(game_id, payload)
    return DataResponse(data=GameResponse.model_validate(game, from_attributes=True))


@admin_router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a game (admin only)")
async def delete_game(game_id: PydanticObjectId) -> None:
    await game_service.delete_game(game_id)
