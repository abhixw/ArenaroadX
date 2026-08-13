import enum

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class ScoringMethod(str, enum.Enum):
    MANUAL_TOTAL_SCORE = "MANUAL_TOTAL_SCORE"
    PLACEMENT_ONLY = "PLACEMENT_ONLY"
    PLACEMENT_AND_KILLS = "PLACEMENT_AND_KILLS"
    CUSTOM_FORMULA = "CUSTOM_FORMULA"


class ScoringRule(BaseDocument):
    tournament_id: PydanticObjectId
    version: int
    method: ScoringMethod
    # Keyed by placement as a string ("1", "2", ...) -- Mongo/BSON object keys must be strings.
    placement_points: dict[str, float] | None = None
    kill_point_value: float | None = None
    # CUSTOM_FORMULA: score = sum(weight * raw_data[field]) -- a bounded, safe weighted-sum
    # config rather than an arbitrary expression parser (never eval() admin input).
    field_weights: dict[str, float] | None = None
    # Ordered tiebreakers; "placement" sorts ascending (lower is better), everything else
    # descending (higher is better) -- see result_service._sort_key.
    tie_break_fields: list[str] = []
    is_active: bool = True

    class Settings:
        name = "scoring_rules"
        indexes = [
            IndexModel([("tournament_id", ASCENDING)], name="ix_scoring_rules_tournament_id"),
        ]
