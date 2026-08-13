from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models.match import MatchStatus


class MatchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    match_number: int
    scheduled_time: datetime
    join_window_opens_at: datetime
    join_window_closes_at: datetime
    room_id: str | None = None
    room_password: str | None = None
    access_info: str | None = None

    @field_validator("match_number")
    @classmethod
    def match_number_positive(cls, value: int) -> int:
        if value < 1:
            raise ValueError("match_number must be a positive integer.")
        return value

    @model_validator(mode="after")
    def window_ordering(self) -> "MatchCreate":
        if self.join_window_opens_at >= self.join_window_closes_at:
            raise ValueError("join_window_opens_at must be before join_window_closes_at.")
        return self


class MatchUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scheduled_time: datetime | None = None
    join_window_opens_at: datetime | None = None
    join_window_closes_at: datetime | None = None
    room_id: str | None = None
    room_password: str | None = None
    access_info: str | None = None


class MatchResponse(BaseModel):
    """Public/participant-facing view -- deliberately excludes room credentials.
    Use MatchAccessResponse (via the dedicated /access endpoint) for those."""

    id: PydanticObjectId
    tournament_id: PydanticObjectId
    match_number: int
    scheduled_time: datetime
    start_time: datetime | None
    end_time: datetime | None
    status: MatchStatus
    join_window_opens_at: datetime
    join_window_closes_at: datetime
    created_at: datetime
    updated_at: datetime


class MatchAccessResponse(BaseModel):
    match_id: PydanticObjectId
    room_id: str | None
    room_password: str | None
    access_info: str | None
