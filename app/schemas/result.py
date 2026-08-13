from datetime import datetime
from typing import Any

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.match_result import MatchResultStatus
from app.models.tournament_result import TournamentResultStatus


class MatchResultCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    game_uid: str
    placement: int | None = None
    kills: int | None = None
    raw_data: dict[str, Any] = {}
    evidence_reference: str | None = None


class MatchResultUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    placement: int | None = None
    kills: int | None = None
    raw_data: dict[str, Any] | None = None
    evidence_reference: str | None = None


class MatchResultCorrection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    placement: int | None = None
    kills: int | None = None
    raw_data: dict[str, Any] | None = None
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A reason is required for a result correction.")
        return value


class MatchResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    match_id: PydanticObjectId
    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    game_uid: str
    placement: int | None
    kills: int | None
    raw_data: dict[str, Any]
    status: MatchResultStatus
    exclusion_reason: str | None
    created_at: datetime
    updated_at: datetime


class TournamentResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    placement_points: float
    kill_points: float
    bonus_points: float
    total_score: float
    rank: int | None
    status: TournamentResultStatus
    scoring_rule_version: int


class ResultRevisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    tournament_id: PydanticObjectId
    match_result_id: PydanticObjectId
    tournament_result_id: PydanticObjectId
    user_id: PydanticObjectId
    changed_by: PydanticObjectId
    reason: str
    changes: dict[str, dict[str, Any]]
    old_rank: int | None
    new_rank: int | None
    old_total_score: float | None
    new_total_score: float | None
    financial_impact_flagged: bool
    created_at: datetime


class CorrectionResponse(BaseModel):
    match_result: MatchResultResponse
    revision: ResultRevisionResponse


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: PydanticObjectId
    player_name: str
    score: float


class LeaderboardResponse(BaseModel):
    tournament_id: PydanticObjectId
    entries: list[LeaderboardEntry]


class UserLeaderboardHistoryEntry(BaseModel):
    tournament_id: PydanticObjectId
    tournament_name: str
    rank: int
    score: float
