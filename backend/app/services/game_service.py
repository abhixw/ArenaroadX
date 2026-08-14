from beanie import PydanticObjectId

from app.core.exceptions import GameAlreadyExistsError, GameInUseError, GameNotFoundError
from app.models.game import Game
from app.models.tournament import Tournament
from app.repositories import game_repository
from app.schemas.game import GameCreate, GameUpdate


async def list_games() -> list[Game]:
    return await game_repository.list_all()


async def get_game(game_id: PydanticObjectId) -> Game:
    game = await game_repository.get_by_id(game_id)
    if game is None:
        raise GameNotFoundError()
    return game


async def create_game(payload: GameCreate) -> Game:
    existing = await game_repository.get_by_name(payload.name)
    if existing is not None:
        raise GameAlreadyExistsError()

    return await game_repository.create(
        name=payload.name,
        description=payload.description,
        image_url=str(payload.image_url) if payload.image_url else None,
        game_type=payload.game_type,
    )


async def update_game(game_id: PydanticObjectId, payload: GameUpdate) -> Game:
    game = await get_game(game_id)

    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != game.name:
        existing = await game_repository.get_by_name(updates["name"])
        if existing is not None:
            raise GameAlreadyExistsError()
    if "image_url" in updates and updates["image_url"] is not None:
        updates["image_url"] = str(updates["image_url"])

    return await game_repository.update(game, **updates)


async def delete_game(game_id: PydanticObjectId) -> None:
    game = await get_game(game_id)

    # MongoDB has no FK constraint to enforce this, so it's checked explicitly here.
    in_use = await Tournament.find_one(Tournament.game_id == game_id)
    if in_use is not None:
        raise GameInUseError()

    await game_repository.delete(game)
