import enum
from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class RefundStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"


class Refund(BaseDocument):
    payment_id: PydanticObjectId
    registration_id: PydanticObjectId
    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    amount_paise: int = Field(ge=0)
    reason: str
    provider_reference: str | None = None
    status: RefundStatus = RefundStatus.PENDING
    processed_by: PydanticObjectId | None = None
    processed_at: datetime | None = None

    class Settings:
        name = "refunds"
        indexes = [
            IndexModel([("tournament_id", ASCENDING)], name="ix_refunds_tournament_id"),
            IndexModel([("user_id", ASCENDING)], name="ix_refunds_user_id"),
            IndexModel([("payment_id", ASCENDING)], name="ix_refunds_payment_id"),
        ]
