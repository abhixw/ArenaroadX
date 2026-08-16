from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class GameCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    image_url: HttpUrl | None = None
    game_type: str | None = Field(default=None, max_length=50)
    # e.g. "chess_com" -- must be a key in app.integrations.REGISTRY. None (the default)
    # means this game has no provider integration; game accounts are UID-only.
    integration_key: str | None = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be empty.")
        return value


class GameUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    image_url: HttpUrl | None = None
    game_type: str | None = Field(default=None, max_length=50)
    is_active: bool | None = None
    integration_key: str | None = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Name must not be empty.")
        return value


class GameResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    name: str
    description: str | None
    image_url: str | None
    game_type: str | None
    is_active: bool
    integration_key: str | None
    created_at: datetime
    updated_at: datetime
