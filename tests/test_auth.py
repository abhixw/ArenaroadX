import pytest

from app.core.dependencies import require_admin
from app.core.exceptions import ForbiddenError
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.repositories import user_repository

VALID_USER = {
    "name": "Abhinav",
    "email": "abhinav@example.com",
    "password": "StrongPassword123",
    "phone": "9876543210",
}


async def test_register_success(client):
    resp = await client.post("/api/auth/register", json=VALID_USER)
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["email"] == VALID_USER["email"]
    assert body["role"] == "USER"
    assert "password" not in body
    assert "password_hash" not in body


async def test_register_duplicate_email(client):
    resp1 = await client.post("/api/auth/register", json=VALID_USER)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/auth/register", json=VALID_USER)
    assert resp2.status_code == 409
    assert resp2.json()["error"]["code"] == "USER_ALREADY_EXISTS"


async def test_register_weak_password_rejected(client):
    payload = {**VALID_USER, "email": "weak@example.com", "password": "weak"}
    resp = await client.post("/api/auth/register", json=payload)
    assert resp.status_code == 422


async def test_register_cannot_assign_admin_role(client):
    payload = {**VALID_USER, "email": "hacker@example.com", "role": "ADMIN"}
    resp = await client.post("/api/auth/register", json=payload)
    # extra="forbid" on the schema rejects any unexpected field, including role
    assert resp.status_code == 422


async def test_login_success_sets_cookie(client):
    await client.post("/api/auth/register", json=VALID_USER)

    resp = await client.post(
        "/api/auth/login", json={"email": VALID_USER["email"], "password": VALID_USER["password"]}
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["email"] == VALID_USER["email"]
    assert "access_token" in resp.cookies


async def test_login_wrong_password(client):
    await client.post("/api/auth/register", json=VALID_USER)

    resp = await client.post("/api/auth/login", json={"email": VALID_USER["email"], "password": "WrongPass123"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_login_nonexistent_user(client):
    resp = await client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "WrongPass123"})
    assert resp.status_code == 401


async def test_get_current_user(client):
    await client.post("/api/auth/register", json=VALID_USER)
    await client.post("/api/auth/login", json={"email": VALID_USER["email"], "password": VALID_USER["password"]})

    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["data"]["email"] == VALID_USER["email"]


async def test_get_current_user_without_cookie(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


async def test_logout_clears_cookie(client):
    await client.post("/api/auth/register", json=VALID_USER)
    await client.post("/api/auth/login", json={"email": VALID_USER["email"], "password": VALID_USER["password"]})

    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 200

    me_resp = await client.get("/api/auth/me")
    assert me_resp.status_code == 401


async def test_admin_login_works(client, db_session):
    admin = await user_repository.create(
        db_session,
        name="Admin",
        email="admin@example.com",
        password_hash=hash_password("AdminPass123"),
        phone="9999999999",
        role=UserRole.ADMIN,
    )
    await db_session.commit()

    resp = await client.post("/api/auth/login", json={"email": admin.email, "password": "AdminPass123"})
    assert resp.status_code == 200
    assert resp.json()["data"]["role"] == "ADMIN"


async def test_require_admin_rejects_regular_user():
    user = User(id=1, name="x", email="x@x.com", password_hash="h", phone="9876543210", role=UserRole.USER)
    with pytest.raises(ForbiddenError):
        await require_admin(current_user=user)


async def test_require_admin_allows_admin():
    admin = User(id=1, name="x", email="x@x.com", password_hash="h", phone="9876543210", role=UserRole.ADMIN)
    result = await require_admin(current_user=admin)
    assert result is admin
