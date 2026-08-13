from typing import Any

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class ResultRevision(BaseDocument):
    tournament_id: PydanticObjectId
    match_result_id: PydanticObjectId
    tournament_result_id: PydanticObjectId
    user_id: PydanticObjectId
    changed_by: PydanticObjectId
    reason: str
    # {"field_name": {"old": ..., "new": ...}}
    changes: dict[str, dict[str, Any]]
    old_rank: int | None = None
    new_rank: int | None = None
    old_total_score: float | None = None
    new_total_score: float | None = None
    # Set true if any PAID prize was linked to this result at the time of correction --
    # spec: "the correction workflow must flag the financial impact for admin review."
    financial_impact_flagged: bool = False

    class Settings:
        name = "result_revisions"
        indexes = [
            IndexModel([("tournament_id", ASCENDING)], name="ix_result_revisions_tournament_id"),
            IndexModel([("tournament_result_id", ASCENDING)], name="ix_result_revisions_tournament_result_id"),
        ]
