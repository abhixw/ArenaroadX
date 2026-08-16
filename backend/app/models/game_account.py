from datetime import datetime
from typing import Any

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class GameAccount(BaseDocument):
    user_id: PydanticObjectId
    game_id: PydanticObjectId
    game_uid: str
    game_username: str | None = None
    verified_at: datetime | None = None
    # Populated only for games with a Game.integration_key (see app.integrations) -- the
    # provider's own player id and a snapshot of whatever public profile data their API
    # returned at verification time. Generic across providers by design.
    provider_player_id: str | None = None
    provider_data: dict[str, Any] = {}

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
