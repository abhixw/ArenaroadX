from beanie import PydanticObjectId

from app.models.user import User, UserRole


async def get_by_id(user_id: PydanticObjectId) -> User | None:
    return await User.get(user_id)


async def get_by_email(email: str) -> User | None:
    return await User.find_one(User.email == email)


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
