import jwt
from beanie import PydanticObjectId
from fastapi import Depends, Request

from app.core.config import settings
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.models.user import User, UserRole
from app.repositories import user_repository


async def get_current_user(request: Request) -> User:
    token = request.cookies.get(settings.COOKIE_NAME)
    if not token:
        raise UnauthorizedError()

    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise UnauthorizedError("Invalid or expired session.")

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedError("Invalid or expired session.")

    try:
        user = await user_repository.get_by_id(PydanticObjectId(user_id))
    except Exception:
        raise UnauthorizedError("Invalid or expired session.")

    if user is None:
        raise UnauthorizedError("Invalid or expired session.")

    return user


async def require_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise ForbiddenError("Admin privileges required.")
    return current_user
