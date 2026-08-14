from datetime import datetime

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class GameAccount(BaseDocument):
    user_id: PydanticObjectId
    game_id: PydanticObjectId
    game_uid: str
    game_username: str | None = None
    verified_at: datetime | None = None

    class Settings:
        name = "game_accounts"
        indexes = [
            IndexModel(
                [("user_id", ASCENDING), ("game_id", ASCENDING)], unique=True, name="uq_game_accounts_user_game"
            ),
            # Prevents two different platform users from claiming the same in-game UID
            # for the same game (result imports match on game_uid, so this must be unambiguous).
            IndexModel(
                [("game_id", ASCENDING), ("game_uid", ASCENDING)], unique=True, name="uq_game_accounts_game_uid"
            ),
        ]
