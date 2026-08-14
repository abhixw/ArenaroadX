from beanie import PydanticObjectId

from app.models.game_account import GameAccount


async def get_by_id(game_account_id: PydanticObjectId) -> GameAccount | None:
    return await GameAccount.get(game_account_id)


async def get_by_user_and_game(user_id: PydanticObjectId, game_id: PydanticObjectId) -> GameAccount | None:
    return await GameAccount.find_one(GameAccount.user_id == user_id, GameAccount.game_id == game_id)


async def get_by_game_and_uid(game_id: PydanticObjectId, game_uid: str) -> GameAccount | None:
    return await GameAccount.find_one(GameAccount.game_id == game_id, GameAccount.game_uid == game_uid)


async def list_by_user(user_id: PydanticObjectId) -> list[GameAccount]:
    return await GameAccount.find(GameAccount.user_id == user_id).to_list()


async def create(*, user_id: PydanticObjectId, game_id: PydanticObjectId, game_uid: str, game_username: str | None) -> GameAccount:
    account = GameAccount(user_id=user_id, game_id=game_id, game_uid=game_uid, game_username=game_username)
    await account.insert()
    return account


async def update(account: GameAccount, **fields) -> GameAccount:
    for key, value in fields.items():
        setattr(account, key, value)
    await account.save()
    return account
