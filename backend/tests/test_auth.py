import pytest

from app.core.config import settings

pytestmark = pytest.mark.asyncio


async def test_register_creates_user_and_sets_cookie(client):
    response = await client.post(
        "/api/auth/register",
        json={"name": "Alice", "email": "alice@example.com", "password": "Password1", "phone": "+919876543210"},
    )
    assert response.status_code == 201
    body = response.json()["data"]
    assert body["email"] == "alice@example.com"
    assert body["role"] == "USER"
    assert settings.COOKIE_NAME in response.cookies


async def test_register_duplicate_email_rejected(client):
    payload = {"name": "Alice", "email": "dup@example.com", "password": "Password1", "phone": "+919876543210"}
    first = await client.post("/api/auth/register", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/auth/register", json=payload)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "USER_ALREADY_EXISTS"


async def test_register_weak_password_rejected(client):
    response = await client.post(
        "/api/auth/register",
        json={"name": "Alice", "email": "weak@example.com", "password": "weak", "phone": "+919876543210"},
    )
    assert response.status_code == 422


async def test_login_success(client):
    await client.post(
        "/api/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "Password1", "phone": "+919876543210"},
    )
    client.cookies.clear()

    response = await client.post("/api/auth/login", json={"email": "bob@example.com", "password": "Password1"})
    assert response.status_code == 200
    assert response.json()["data"]["email"] == "bob@example.com"


async def test_login_wrong_password_rejected(client):
    await client.post(
        "/api/auth/register",
        json={"name": "Bob", "email": "bob2@example.com", "password": "Password1", "phone": "+919876543210"},
    )
    client.cookies.clear()

    response = await client.post("/api/auth/login", json={"email": "bob2@example.com", "password": "WrongPass1"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_me_requires_auth(client):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


async def test_me_returns_current_user(client, as_user):
    response = await client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["data"]["id"] == str(as_user.id)


async def test_logout_clears_cookie(client, as_user):
    response = await client.post("/api/auth/logout")
    assert response.status_code == 200

    me = await client.get("/api/auth/me")
    assert me.status_code == 401


async def test_update_profile(client, as_user):
    response = await client.put("/api/auth/me", json={"name": "New Name"})
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "New Name"


async def test_admin_reset_password_requires_admin(client, as_user, user_factory):
    target = await user_factory(email="target@example.com")
    response = await client.post(f"/api/admin/users/{target.id}/reset-password", json={"new_password": "NewPass1"})
    assert response.status_code == 403


async def test_admin_reset_password_lets_target_log_in_with_new_password(client, as_admin, user_factory):
    target = await user_factory(email="target2@example.com")

    reset = await client.post(f"/api/admin/users/{target.id}/reset-password", json={"new_password": "NewPass1"})
    assert reset.status_code == 200

    other_client_login = await client.post(
        "/api/auth/login", json={"email": target.email, "password": "Password1"}
    )
    assert other_client_login.status_code == 401

    with_new_password = await client.post(
        "/api/auth/login", json={"email": target.email, "password": "NewPass1"}
    )
    assert with_new_password.status_code == 200


async def test_admin_reset_password_rejects_weak_password(client, as_admin, user_factory):
    target = await user_factory(email="target3@example.com")
    response = await client.post(f"/api/admin/users/{target.id}/reset-password", json={"new_password": "weak"})
    assert response.status_code == 422


async def test_admin_origin_separation(client, user_factory, admin_factory, monkeypatch):
    """An account's role must match whether the request came from the admin origin, in both
    directions -- see app.routers.auth.login. Locks in the bidirectional deployment
    separation between the player and admin frontends."""
    monkeypatch.setattr(settings, "ADMIN_ORIGIN", "https://admin.example.com")

    admin = await admin_factory(email="admin-origin@example.com")
    user = await user_factory(email="user-origin@example.com")

    admin_ok = await client.post(
        "/api/auth/login",
        json={"email": admin.email, "password": "Password1"},
        headers={"Origin": "https://admin.example.com"},
    )
    assert admin_ok.status_code == 200

    admin_from_player_origin = await client.post(
        "/api/auth/login",
        json={"email": admin.email, "password": "Password1"},
        headers={"Origin": "https://player.example.com"},
    )
    assert admin_from_player_origin.status_code == 401
    assert admin_from_player_origin.json()["error"]["code"] == "INVALID_CREDENTIALS"

    user_ok = await client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "Password1"},
        headers={"Origin": "https://player.example.com"},
    )
    assert user_ok.status_code == 200

    user_from_admin_origin = await client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "Password1"},
        headers={"Origin": "https://admin.example.com"},
    )
    assert user_from_admin_origin.status_code == 401
    assert user_from_admin_origin.json()["error"]["code"] == "INVALID_CREDENTIALS"
