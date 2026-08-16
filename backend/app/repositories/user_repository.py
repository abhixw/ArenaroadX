import re

from beanie import PydanticObjectId
from beanie.operators import Or, RegEx

from app.models.user import User, UserRole


async def get_by_id(user_id: PydanticObjectId) -> User | None:
    return await User.get(user_id)


async def get_by_email(email: str) -> User | None:
    return await User.find_one(User.email == email)


async def get_by_reset_token_hash(token_hash: str) -> User | None:
    return await User.find_one(User.password_reset_token_hash == token_hash)


async def list_all(*, search: str | None = None, page: int = 1, page_size: int = 20) -> tuple[list[User], int]:
    query = User.find()
    if search:
        pattern = re.escape(search.strip())
        query = query.find(Or(RegEx(User.name, pattern, "i"), RegEx(User.email, pattern, "i")))
    total = await query.count()
    items = await query.sort(-User.created_at).skip((page - 1) * page_size).limit(page_size).to_list()
    return items, total


async def create(
    *,
    name: str,
    email: str,
    password_hash: str,
    phone: str,
    role: UserRole = UserRole.USER,
) -> User:
    user = User(name=name, email=email, password_hash=password_hash, phone=phone, role=role)
    await user.insert()
    return user


async def update(user: User, **fields) -> User:
    for key, value in fields.items():
        setattr(user, key, value)
    await user.save()
    return user
