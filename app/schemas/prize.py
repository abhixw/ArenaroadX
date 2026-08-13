from datetime import datetime
from decimal import Decimal

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field

from app.models.prize import PrizePayoutStatus


class PrizeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: PydanticObjectId
    rank: int = Field(gt=0)
    amount: Decimal = Field(ge=0)


class PrizeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: PydanticObjectId | None = None
    rank: int | None = Field(default=None, gt=0)
    amount: Decimal | None = Field(default=None, ge=0)


class PrizeResponse(BaseModel):
    id: PydanticObjectId
    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    rank: int
    amount: Decimal
    payout_status: PrizePayoutStatus
    paid_at: datetime | None
    created_at: datetime
    updated_at: datetime
