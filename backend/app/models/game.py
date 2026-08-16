from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class Game(BaseDocument):
    name: str
    description: str | None = None
    image_url: str | None = None
    game_type: str | None = None
    is_active: bool = True
    # Key into app.integrations.REGISTRY (e.g. "chess_com") -- set only for games with a
    # supported provider integration. None means game accounts for this game are UID-only,
    # entered and trusted as-is (the original, still-default flow for games with no public API).
    integration_key: str | None = None

    class Settings:
        name = "games"
        indexes = [
            IndexModel([("name", ASCENDING)], unique=True, name="uq_games_name"),
        ]
