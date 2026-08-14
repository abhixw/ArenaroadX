import enum

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class TransactionType(str, enum.Enum):
    ENTRY_FEE = "ENTRY_FEE"
    REFUND = "REFUND"
    PRIZE = "PRIZE"
    ADJUSTMENT = "ADJUSTMENT"


class Transaction(BaseDocument):
    """Append-only financial ledger. Never updated or deleted after creation."""

    tournament_id: PydanticObjectId
    user_id: PydanticObjectId
    type: TransactionType
    # Signed: positive = money in to the platform (ENTRY_FEE), negative = money out
    # (REFUND, PRIZE). ADJUSTMENT can be either sign for manual corrections.
    amount_paise: int
    reference_id: PydanticObjectId | None = None
    note: str | None = None

    class Settings:
        name = "transactions"
        indexes = [
            IndexModel([("tournament_id", ASCENDING)], name="ix_transactions_tournament_id"),
            IndexModel([("user_id", ASCENDING)], name="ix_transactions_user_id"),
        ]
