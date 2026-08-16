from datetime import datetime
from typing import Any

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field, field_validator


class GameAccountUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    game_uid: str = Field(max_length=100)
    game_username: str | None = Field(default=None, max_length=100)

    @field_validator("game_uid")
    @classmethod
    def game_uid_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("game_uid must not be empty.")
        return value


class GameAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    user_id: PydanticObjectId
    game_id: PydanticObjectId
    game_uid: str
    game_username: str | None
    verified_at: datetime | None
    provider_player_id: str | None
    provider_data: dict[str, Any]
    created_at: datetime
    updated_at: datetime
