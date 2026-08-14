import enum
from datetime import datetime

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class MatchStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    LIVE = "LIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ResultSource(str, enum.Enum):
    OFFICIAL_API = "OFFICIAL_API"
    OFFICIAL_EXPORT = "OFFICIAL_EXPORT"
    ADMIN_IMPORT = "ADMIN_IMPORT"
    ADMIN_MANUAL = "ADMIN_MANUAL"


class Match(BaseDocument):
    tournament_id: PydanticObjectId
    match_number: int
    scheduled_time: datetime
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: MatchStatus = MatchStatus.SCHEDULED
    result_source: ResultSource | None = None

    # Room/game access -- only ever revealed to eligible confirmed participants via a
    # dedicated endpoint, never included in the general match listing (see match_service).
    room_id: str | None = None
    room_password: str | None = None
    access_info: str | None = None
    join_window_opens_at: datetime
    join_window_closes_at: datetime

    class Settings:
        name = "matches"
        indexes = [
            IndexModel([("tournament_id", ASCENDING)], name="ix_matches_tournament_id"),
            IndexModel(
                [("tournament_id", ASCENDING), ("match_number", ASCENDING)],
                unique=True,
                name="uq_matches_tournament_match_number",
            ),
        ]
