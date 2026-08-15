import pytest
import pytest_asyncio
from beanie import init_beanie
from httpx import ASGITransport, AsyncClient
from pymongo import AsyncMongoClient

from app.core.config import settings
from app.core.rate_limit import _buckets as _rate_limit_buckets
from app.core.security import hash_password
from app.main import app
from app.models import ALL_DOCUMENT_MODELS
from app.models.user import User, UserRole
from app.repositories import user_repository

DEFAULT_PASSWORD = "Password1"


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    # The login/register limiter is an in-memory, per-process bucket keyed by client IP (see
    # app.core.rate_limit) -- every test's requests share one IP under ASGITransport, so
    # without a reset here, a handful of tests logging in via as_user/as_admin would trip it.
    _rate_limit_buckets.clear()


@pytest.fixture(autouse=True)
def _default_admin_origin(monkeypatch):
    # A developer's local .env commonly sets ADMIN_ORIGIN to a real URL for manual
    # dual-deployment testing (see app.routers.auth.login) -- the suite must not inherit
    # that ambient config, or every admin login without a matching Origin header (i.e. every
    # admin login made by this suite's plain httpx client) gets rejected as a mismatch.
    # test_admin_origin_separation opts back in explicitly with its own monkeypatch.
    monkeypatch.setattr(settings, "ADMIN_ORIGIN", "")

if not settings.TEST_MONGODB_URL:
    raise RuntimeError(
        "TEST_MONGODB_URL must be set in the environment to run the test suite "
        "(point it at a local/dedicated MongoDB replica set, never production)."
    )


@pytest_asyncio.fixture(autouse=True)
async def _mongo():
    # Function-scoped and created fresh per test: AsyncMongoClient binds to whatever asyncio
    # event loop is running when it's first used, and pytest-asyncio gives each test its own
    # loop by default -- a client created at import time (or in a session-scoped fixture)
    # would be bound to a loop that no longer exists by the time a later test runs it.
    # A dedicated client/database, separate from the app's own prod-pointed client in
    # app.core.database -- init_beanie below binds every Document class to this one instead, so
    # nothing in the suite can ever touch the real database regardless of what main.py's
    # lifespan would otherwise connect to (which we never trigger -- see the `client` fixture).
    test_mongo_client: AsyncMongoClient = AsyncMongoClient(settings.TEST_MONGODB_URL, tz_aware=True)
    await init_beanie(
        database=test_mongo_client[settings.TEST_MONGODB_DB_NAME],
        document_models=ALL_DOCUMENT_MODELS,
    )
    yield
    for model in ALL_DOCUMENT_MODELS:
        await model.get_pymongo_collection().delete_many({})
    await test_mongo_client.close()


@pytest_asyncio.fixture
async def client():
    # ASGITransport never fires FastAPI's lifespan handlers, so app.main's init_db (which
    # points at the real MONGODB_URL) is simply never called during tests.
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _create_user(
    *, role: UserRole, email: str, password: str = DEFAULT_PASSWORD, name: str = "Test User", phone: str = "+911234567890"
) -> User:
    return await user_repository.create(
        name=name, email=email, password_hash=hash_password(password), phone=phone, role=role
    )


@pytest_asyncio.fixture
async def user_factory():
    async def _factory(*, email: str = "user@example.com", **kwargs) -> User:
        return await _create_user(role=UserRole.USER, email=email, **kwargs)

    return _factory


@pytest_asyncio.fixture
async def admin_factory():
    async def _factory(*, email: str = "admin@example.com", **kwargs) -> User:
        return await _create_user(role=UserRole.ADMIN, email=email, **kwargs)

    return _factory


async def login_as(client: AsyncClient, user: User, password: str = DEFAULT_PASSWORD) -> None:
    # Goes through the real /login endpoint (rather than poking the client's cookie jar
    # directly) so the cookie in the jar is a genuine Set-Cookie response, with the same
    # domain/path httpx recorded for it as any other cookie the app sets -- notably this
    # is what lets a later /logout's delete_cookie actually match and evict it.
    response = await client.post("/api/auth/login", json={"email": user.email, "password": password})
    assert response.status_code == 200, response.text


@pytest_asyncio.fixture
async def as_user(client, user_factory):
    user = await user_factory()
    await login_as(client, user)
    return user


@pytest_asyncio.fixture
async def as_admin(client, admin_factory):
    admin = await admin_factory()
    await login_as(client, admin)
    return admin
