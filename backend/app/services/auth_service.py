from app.core.exceptions import InvalidCredentialsError, UserAlreadyExistsError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.repositories import user_repository
from app.schemas.auth import LoginRequest, RegisterRequest, UpdateProfileRequest


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
    return create_access_token(subject=str(user.id), role=user.role.value)


async def update_profile(user: User, payload: UpdateProfileRequest) -> User:
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        return user
    return await user_repository.update(user, **updates)
