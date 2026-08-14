from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class Game(BaseDocument):
    name: str
    description: str | None = None
    image_url: str | None = None
    game_type: str | None = None
    is_active: bool = True

    class Settings:
        name = "games"
        indexes = [
            IndexModel([("name", ASCENDING)], unique=True, name="uq_games_name"),
        ]
