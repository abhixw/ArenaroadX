import enum

from pydantic import EmailStr, Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    BANNED = "BANNED"


class User(BaseDocument):
    name: str
    email: EmailStr
    password_hash: str
    phone: str
    role: UserRole = UserRole.USER
    status: UserStatus = Field(default=UserStatus.ACTIVE)

    class Settings:
        name = "users"
        indexes = [
            IndexModel([("email", ASCENDING)], unique=True, name="uq_users_email"),
        ]
