import logging
from datetime import datetime, timedelta, timezone

from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.email import send_email
from app.core.rate_limit import check_rate_limit
from app.core.exceptions import InvalidCredentialsError, InvalidOrExpiredResetTokenError, UserAlreadyExistsError
from app.core.security import (
    create_access_token,
    generate_password_reset_token,
    hash_password,
    hash_password_reset_token,
    verify_password,
)
from app.models.user import User, UserRole
from app.repositories import user_repository
from app.schemas.auth import LoginRequest, RegisterRequest, UpdateProfileRequest

logger = logging.getLogger("tournament_backend")


async def register_user(payload: RegisterRequest) -> User:
    existing = await user_repository.get_by_email(payload.email)
    if existing is not None:
        raise UserAlreadyExistsError()

    return await user_repository.create(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        phone=payload.phone,
        role=UserRole.USER,
    )


async def authenticate_user(payload: LoginRequest) -> User:
    user = await user_repository.get_by_email(payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise InvalidCredentialsError()
    return user


def issue_access_token(user: User) -> str:
    return create_access_token(subject=str(user.id), role=user.role.value, token_version=user.token_version)


async def update_profile(user: User, payload: UpdateProfileRequest) -> User:
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        return user
    return await user_repository.update(user, **updates)


async def request_password_reset(email: str) -> None:
    # Keyed on the target email (in addition to the router's per-IP limit) so a single IP
    # can't email-bomb one victim by resubmitting the same address past the IP bucket's
    # tolerance for legitimate shared-IP traffic (offices, mobile carriers, NAT).
    check_rate_limit("forgot_password_email", email.lower(), limit=5, window_seconds=3600)

    user = await user_repository.get_by_email(email)
    if user is None:
        # Same response either way -- otherwise this endpoint becomes a way to probe which
        # emails have an account.
        return

    token = generate_password_reset_token()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    await user_repository.update(
        user,
        password_reset_token_hash=hash_password_reset_token(token),
        password_reset_expires_at=expires_at,
    )

    reset_link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    try:
        # Off the event loop: smtplib is blocking socket I/O, and this must not stall every
        # other in-flight request for the duration of an SMTP round-trip.
        await run_in_threadpool(
            send_email,
            to=user.email,
            subject="Reset your ArenaroadX password",
            body=(
                f"Hi {user.name},\n\n"
                "We received a request to reset your ArenaroadX password. This link expires in "
                f"{settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes:\n\n"
                f"{reset_link}\n\n"
                "If you didn't request this, you can safely ignore this email -- your password "
                "will not be changed."
            ),
        )
    except Exception:
        # Must not propagate: an SMTP outage would otherwise make this endpoint 500 only for
        # emails that *do* have an account (the no-such-user path above returns before ever
        # reaching this point), which is itself an account-enumeration oracle.
        logger.exception("Failed to send password reset email to %s", user.email)


async def reset_password(token: str, new_password: str) -> None:
    user = await user_repository.get_by_reset_token_hash(hash_password_reset_token(token))
    if (
        user is None
        or user.password_reset_expires_at is None
        or user.password_reset_expires_at < datetime.now(timezone.utc)
    ):
        raise InvalidOrExpiredResetTokenError()

    await user_repository.update(
        user,
        password_hash=hash_password(new_password),
        password_reset_token_hash=None,
        password_reset_expires_at=None,
        token_version=user.token_version + 1,
    )
