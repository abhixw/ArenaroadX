import enum
from datetime import datetime

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class RegistrationStatus(str, enum.Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    DISQUALIFIED = "DISQUALIFIED"
    EXPIRED = "EXPIRED"


class RegistrationPaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CAPTURED = "CAPTURED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


# Registrations still counted as holding a slot while payment is in flight.
ACTIVE_REGISTRATION_STATUSES = (RegistrationStatus.PENDING_PAYMENT, RegistrationStatus.CONFIRMED)


class Registration(BaseDocument):
    user_id: PydanticObjectId
    tournament_id: PydanticObjectId
    game_account_id: PydanticObjectId
    # Snapshotted at registration time so later edits to the GameAccount (before it's
    # locked) never retroactively change what a past/in-progress registration recorded.
    game_uid: str
    game_username: str | None = None
    payment_id: PydanticObjectId | None = None
    registration_status: RegistrationStatus = RegistrationStatus.PENDING_PAYMENT
    payment_status: RegistrationPaymentStatus = RegistrationPaymentStatus.PENDING
    # Temporary slot hold; swept and released if payment isn't completed by this time
    # (see registration_service._sweep_expired_reservations -- no background worker in this MVP).
    reserved_until: datetime
    disqualification_reason: str | None = None

    class Settings:
        name = "registrations"
        indexes = [
            # Partial: only PENDING_PAYMENT/CONFIRMED registrations are constrained unique,
            # so a user whose reservation expired or was cancelled can register again.
            IndexModel(
                [("user_id", ASCENDING), ("tournament_id", ASCENDING)],
                unique=True,
                name="uq_registrations_active_user_tournament",
                partialFilterExpression={"registration_status": {"$in": ["PENDING_PAYMENT", "CONFIRMED"]}},
            ),
            IndexModel([("tournament_id", ASCENDING)], name="ix_registrations_tournament_id"),
            IndexModel([("user_id", ASCENDING)], name="ix_registrations_user_id"),
        ]
