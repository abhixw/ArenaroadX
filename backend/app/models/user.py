import enum
from datetime import datetime

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

    # Self-service "forgot password" flow -- set together on a reset request, cleared
    # together once the token is used (or superseded by a newer request). The token itself
    # is never stored, only its hash (see app.core.security.hash_password_reset_token).
    password_reset_token_hash: str | None = Field(default=None)
    password_reset_expires_at: datetime | None = Field(default=None)

    # Bumped whenever a password is changed (self-service reset or admin reset) so every
    # already-issued JWT -- which is otherwise stateless and has no revocation list --
    # stops validating (see app.core.dependencies.get_current_user). Without this, resetting
    # a compromised account's password would not actually log the attacker out.
    token_version: int = Field(default=0)

    class Settings:
        name = "users"
        indexes = [
            IndexModel([("email", ASCENDING)], unique=True, name="uq_users_email"),
            IndexModel(
                [("password_reset_token_hash", ASCENDING)],
                name="idx_users_password_reset_token_hash",
                sparse=True,
            ),
        ]
