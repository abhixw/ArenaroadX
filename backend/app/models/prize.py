import enum
from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class PrizePayoutStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"


class Prize(BaseDocument):
    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    rank: int = Field(gt=0)
    amount_paise: int = Field(ge=0)
    payout_status: PrizePayoutStatus = PrizePayoutStatus.PENDING
    paid_at: datetime | None = None
    # MVP: always manual (no automated allocation engine) -- field kept for the normalized
    # "allocation source" the spec calls for, so a future auto-allocator can coexist cleanly.
    allocation_source: str = "ADMIN_MANUAL"

    class Settings:
        name = "prizes"
        indexes = [
            IndexModel([("tournament_id", ASCENDING)], name="ix_prizes_tournament_id"),
            IndexModel([("user_id", ASCENDING)], name="ix_prizes_user_id"),
        ]
