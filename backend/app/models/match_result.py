import enum
from typing import Any

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument
from app.models.match import ResultSource


class MatchResultStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    EXCLUDED = "EXCLUDED"


class MatchResult(BaseDocument):
    match_id: PydanticObjectId
    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    game_uid: str
    placement: int | None = None
    kills: int | None = None
    raw_data: dict[str, Any] = {}
    source: ResultSource
    evidence_reference: str | None = None
    status: MatchResultStatus = MatchResultStatus.DRAFT
    exclusion_reason: str | None = None

    class Settings:
        name = "match_results"
        indexes = [
            IndexModel([("match_id", ASCENDING)], name="ix_match_results_match_id"),
            IndexModel(
                [("match_id", ASCENDING), ("user_id", ASCENDING)], unique=True, name="uq_match_results_match_user"
            ),
            IndexModel([("tournament_id", ASCENDING)], name="ix_match_results_tournament_id"),
        ]
