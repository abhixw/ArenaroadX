"""Create the initial ADMIN account from environment variables.

This is an explicit, operator-run CLI step. There is no public API that can create
an ADMIN account -- run this script manually (or via a controlled deploy step) instead.

Usage:
    python -m scripts.create_admin
"""

import asyncio
import sys

from app.core.config import settings
from app.core.database import init_db
from app.core.security import hash_password
from app.models import ALL_DOCUMENT_MODELS
from app.models.user import UserRole
from app.repositories import user_repository


async def create_admin() -> None:
    if not settings.INITIAL_ADMIN_EMAIL or not settings.INITIAL_ADMIN_PASSWORD:
        print("INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be set in the environment.", file=sys.stderr)
        raise SystemExit(1)

    await init_db(document_models=ALL_DOCUMENT_MODELS)

    existing = await user_repository.get_by_email(settings.INITIAL_ADMIN_EMAIL)
    if existing is not None:
        print(f"User with email {settings.INITIAL_ADMIN_EMAIL} already exists (role={existing.role.value}).")
        if existing.role != UserRole.ADMIN:
            print("Refusing to change an existing user's role automatically.", file=sys.stderr)
            raise SystemExit(1)
        return

    admin = await user_repository.create(
        name=settings.INITIAL_ADMIN_NAME,
        email=settings.INITIAL_ADMIN_EMAIL,
        password_hash=hash_password(settings.INITIAL_ADMIN_PASSWORD),
        phone="0000000000",
        role=UserRole.ADMIN,
    )
    print(f"Created ADMIN user: {admin.email} (id={admin.id})")


if __name__ == "__main__":
    asyncio.run(create_admin())
