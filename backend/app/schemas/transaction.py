from datetime import datetime
from decimal import Decimal

from beanie import PydanticObjectId
from pydantic import BaseModel

from app.models.transaction import TransactionType


class TransactionResponse(BaseModel):
    id: PydanticObjectId
    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    type: TransactionType
    amount: Decimal
    reference_id: PydanticObjectId | None
    note: str | None
    created_at: datetime
