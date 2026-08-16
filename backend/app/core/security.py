import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(
    subject: str, role: str, token_version: int = 0, expires_minutes: int | None = None
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes if expires_minutes is not None else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {"sub": subject, "role": role, "tv": token_version, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def generate_password_reset_token() -> str:
    return secrets.token_urlsafe(32)


def hash_password_reset_token(token: str) -> str:
    # A fast, unsalted hash is fine (and desirable) here: unlike a login password, this token
    # is a single high-entropy random value the user never chooses, generated fresh per reset
    # request, and single-use -- so it isn't vulnerable to dictionary/rainbow-table attacks
    # the way a slow password hash defends against. We only need to avoid storing the raw
    # token so a DB read alone can't be used to reset an account.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
