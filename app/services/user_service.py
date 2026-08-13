from beanie import PydanticObjectId

from app.core.exceptions import UserNotFoundError
from app.models.user import User, UserStatus
from app.repositories import user_repository


async def list_users(search: str | None = None) -> list[User]:
    return await user_repository.list_all(search=search)


async def update_status(user_id: PydanticObjectId, status: UserStatus) -> User:
    user = await user_repository.get_by_id(user_id)
    if user is None:
        raise UserNotFoundError()
    return await user_repository.update(user, status=status)
