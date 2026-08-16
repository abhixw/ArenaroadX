from datetime import datetime
from decimal import Decimal

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.refund import RefundStatus


class ProcessRefundRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_reference: str = Field(max_length=200)

    @field_validator("provider_reference")
    @classmethod
    def not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("provider_reference is required to mark a refund processed.")
        return value


class RefundResponse(BaseModel):
    id: PydanticObjectId
    payment_id: PydanticObjectId
    registration_id: PydanticObjectId
    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    amount: Decimal
    reason: str
    provider_reference: str | None
    status: RefundStatus
    processed_by: PydanticObjectId | None
    processed_at: datetime | None
    created_at: datetime
