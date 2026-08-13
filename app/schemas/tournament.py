from datetime import datetime
from decimal import Decimal

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from app.models.tournament import TournamentStatus


def _require_tz_aware(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None:
        raise ValueError(f"{field_name} must be timezone-aware (UTC).")
    return value


class TournamentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    game_id: PydanticObjectId
    name: str
    description: str | None = None
    entry_fee: Decimal = Field(ge=0)
    prize_pool: Decimal = Field(ge=0)
    max_players: int = Field(gt=0)
    start_time: datetime
    registration_deadline: datetime
    game_url: HttpUrl | None = None
    rules: str | None = None
    instructions: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be empty.")
        return value

    @field_validator("start_time")
    @classmethod
    def start_time_tz_aware(cls, value: datetime) -> datetime:
        return _require_tz_aware(value, "start_time")

    @field_validator("registration_deadline")
    @classmethod
    def registration_deadline_tz_aware(cls, value: datetime) -> datetime:
        return _require_tz_aware(value, "registration_deadline")

    @model_validator(mode="after")
    def deadline_before_start(self) -> "TournamentCreate":
        if self.registration_deadline >= self.start_time:
            raise ValueError("registration_deadline must be before start_time.")
        return self


class TournamentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    game_id: PydanticObjectId | None = None
    name: str | None = None
    description: str | None = None
    entry_fee: Decimal | None = Field(default=None, ge=0)
    prize_pool: Decimal | None = Field(default=None, ge=0)
    max_players: int | None = Field(default=None, gt=0)
    start_time: datetime | None = None
    registration_deadline: datetime | None = None
    game_url: HttpUrl | None = None
    rules: str | None = None
    instructions: str | None = None
    status: TournamentStatus | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Name must not be empty.")
        return value

    @field_validator("start_time")
    @classmethod
    def start_time_tz_aware(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return value
        return _require_tz_aware(value, "start_time")

    @field_validator("registration_deadline")
    @classmethod
    def registration_deadline_tz_aware(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return value
        return _require_tz_aware(value, "registration_deadline")

    @model_validator(mode="after")
    def deadline_before_start_if_both_present(self) -> "TournamentUpdate":
        if self.start_time is not None and self.registration_deadline is not None:
            if self.registration_deadline >= self.start_time:
                raise ValueError("registration_deadline must be before start_time.")
        return self


class CancelTournamentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A reason is required to cancel a tournament.")
        return value


class TournamentResponse(BaseModel):
    id: PydanticObjectId
    game_id: PydanticObjectId
    name: str
    description: str | None
    entry_fee: Decimal
    prize_pool: Decimal
    max_players: int
    start_time: datetime
    registration_deadline: datetime
    game_url: str | None
    rules: str | None
    instructions: str | None
    status: TournamentStatus
    cancellation_reason: str | None = None
    created_at: datetime
    updated_at: datetime
