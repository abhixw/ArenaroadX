import enum

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class PaymentStatus(str, enum.Enum):
    CREATED = "CREATED"
    PENDING = "PENDING"
    CAPTURED = "CAPTURED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class Payment(BaseDocument):
    user_id: PydanticObjectId
    tournament_id: PydanticObjectId
    registration_id: PydanticObjectId
    amount_paise: int = Field(ge=0)
    currency: str = "INR"
    razorpay_order_id: str
    razorpay_payment_id: str | None = None
    razorpay_signature: str | None = None
    status: PaymentStatus = PaymentStatus.CREATED

    class Settings:
        name = "payments"
        indexes = [
            IndexModel([("razorpay_order_id", ASCENDING)], unique=True, name="uq_payments_razorpay_order_id"),
            IndexModel([("razorpay_payment_id", ASCENDING)], name="ix_payments_razorpay_payment_id"),
            IndexModel([("user_id", ASCENDING)], name="ix_payments_user_id"),
            IndexModel([("tournament_id", ASCENDING)], name="ix_payments_tournament_id"),
            IndexModel([("registration_id", ASCENDING)], name="ix_payments_registration_id"),
        ]
