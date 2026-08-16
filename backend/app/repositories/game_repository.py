from beanie import PydanticObjectId

from app.models.game import Game


async def get_by_id(game_id: PydanticObjectId) -> Game | None:
    return await Game.get(game_id)


async def get_by_name(name: str) -> Game | None:
    return await Game.find_one(Game.name == name)


async def list_all() -> list[Game]:
    return await Game.find_all().sort(+Game.name).to_list()


async def create(
    *,
    name: str,
    description: str | None,
    image_url: str | None,
    game_type: str | None,
    integration_key: str | None = None,
) -> Game:
    game = Game(
        name=name, description=description, image_url=image_url, game_type=game_type, integration_key=integration_key
    )
    await game.insert()
    return game


async def update(game: Game, **fields) -> Game:
    for key, value in fields.items():
        setattr(game, key, value)
    await game.save()
    return game


async def delete(game: Game) -> None:
    await game.delete()
