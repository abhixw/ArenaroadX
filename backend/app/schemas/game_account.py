from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, field_validator


class GameAccountUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    game_uid: str
    game_username: str | None = None

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
    created_at: datetime
    updated_at: datetime
