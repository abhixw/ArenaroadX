import enum

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class MatchParticipationStatus(str, enum.Enum):
    REGISTERED = "REGISTERED"
    DISQUALIFIED = "DISQUALIFIED"
    NO_SHOW = "NO_SHOW"


class MatchParticipant(BaseDocument):
    match_id: PydanticObjectId
    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    game_account_id: PydanticObjectId
    game_uid: str
    participation_status: MatchParticipationStatus = MatchParticipationStatus.REGISTERED

    class Settings:
        name = "match_participants"
        indexes = [
            IndexModel([("match_id", ASCENDING)], name="ix_match_participants_match_id"),
            IndexModel(
                [("match_id", ASCENDING), ("user_id", ASCENDING)],
                unique=True,
                name="uq_match_participants_match_user",
            ),
            IndexModel([("match_id", ASCENDING), ("game_uid", ASCENDING)], name="ix_match_participants_game_uid"),
        ]
