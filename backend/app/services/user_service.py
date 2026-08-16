from beanie import PydanticObjectId

from app.core.exceptions import UserNotFoundError
from app.core.security import hash_password
from app.models.user import User, UserStatus
from app.repositories import user_repository


async def list_users(*, search: str | None = None, page: int = 1, page_size: int = 20) -> tuple[list[User], int]:
    return await user_repository.list_all(search=search, page=page, page_size=page_size)


async def update_status(user_id: PydanticObjectId, status: UserStatus) -> User:
    user = await user_repository.get_by_id(user_id)
    if user is None:
        raise UserNotFoundError()
    return await user_repository.update(user, status=status)


async def reset_password(user_id: PydanticObjectId, new_password: str) -> User:
    user = await user_repository.get_by_id(user_id)
    if user is None:
        raise UserNotFoundError()
    return await user_repository.update(
        user, password_hash=hash_password(new_password), token_version=user.token_version + 1
    )
