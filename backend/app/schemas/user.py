from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.user import UserRole, UserStatus
from app.schemas.auth import validate_password_strength


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    name: str
    email: str
    phone: str
    role: UserRole
    status: UserStatus
    created_at: datetime


class UpdateUserStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: UserStatus
    # Not persisted on the User document itself -- captured in the audit log (AuditLogMiddleware
    # records admin request bodies) so there's still a record of why.
    reason: str | None = None

    @field_validator("reason")
    @classmethod
    def reason_not_blank_if_present(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("reason must not be blank if provided.")
        return value


class AdminResetPasswordRequest(BaseModel):
    """Lets an admin set a new password directly and relay it to the player out-of-band
    (phone/WhatsApp), for cases where the player can't complete the self-service
    forgot-password email flow themselves (e.g. lost access to their inbox)."""

    model_config = ConfigDict(extra="forbid")

    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, value: str) -> str:
        return validate_password_strength(value)
