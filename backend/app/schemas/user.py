from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.user import UserRole, UserStatus


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
