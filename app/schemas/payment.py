from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict

from app.models.payment import PaymentStatus


class CreateOrderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tournament_id: PydanticObjectId


class CreateOrderResponse(BaseModel):
    payment_id: PydanticObjectId
    order_id: str
    amount: int  # smallest currency unit (paise), per Razorpay convention
    currency: str


class VerifyPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    user_id: PydanticObjectId
    tournament_id: PydanticObjectId
    registration_id: PydanticObjectId
    amount_paise: int
    currency: str
    razorpay_order_id: str
    razorpay_payment_id: str | None
    status: PaymentStatus
    created_at: datetime
    updated_at: datetime


class AdminPaymentResponse(BaseModel):
    id: PydanticObjectId
    user_id: PydanticObjectId
    player_name: str
    player_email: str
    tournament_id: PydanticObjectId
    tournament_name: str
    amount_paise: int
    currency: str
    razorpay_order_id: str
    razorpay_payment_id: str | None
    status: PaymentStatus
    created_at: datetime
