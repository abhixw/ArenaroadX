import enum

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class TournamentResultStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"


class TournamentResult(BaseDocument):
    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    match_result_id: PydanticObjectId
    scoring_rule_id: PydanticObjectId
    scoring_rule_version: int
    placement_points: float = 0
    kill_points: float = 0
    bonus_points: float = 0
    total_score: float = 0
    rank: int | None = None
    status: TournamentResultStatus = TournamentResultStatus.DRAFT

    class Settings:
        name = "tournament_results"
        indexes = [
            IndexModel([("tournament_id", ASCENDING)], name="ix_tournament_results_tournament_id"),
            IndexModel(
                [("tournament_id", ASCENDING), ("user_id", ASCENDING)],
                unique=True,
                name="uq_tournament_results_tournament_user",
            ),
        ]
