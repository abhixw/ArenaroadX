from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole, UserStatus


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    name: str
    email: str
    phone: str
    role: UserRole
    status: UserStatus
