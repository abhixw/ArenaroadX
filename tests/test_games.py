from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.models.user import UserRole
from app.repositories import tournament_repository, user_repository

VALID_GAME = {
    "name": "Chess",
    "description": "Classic strategy board game.",
    "game_type": "STRATEGY",
}


async def _register_and_login_user(client) -> None:
    await client.post(
        "/api/auth/register",
        json={"name": "Player", "email": "player@example.com", "password": "StrongPassword123", "phone": "9876543210"},
    )
    await client.post("/api/auth/login", json={"email": "player@example.com", "password": "StrongPassword123"})


async def _create_and_login_admin(client, db_session) -> None:
    admin = await user_repository.create(
        db_session,
        name="Admin",
        email="admin@example.com",
        password_hash=hash_password("AdminPass123"),
        phone="9999999999",
        role=UserRole.ADMIN,
    )
    await db_session.commit()
    await client.post("/api/auth/login", json={"email": admin.email, "password": "AdminPass123"})


async def test_list_games_empty(client):
    resp = await client.get("/api/games")
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_admin_can_create_game(client, db_session):
    await _create_and_login_admin(client, db_session)

    resp = await client.post("/api/admin/games", json=VALID_GAME)
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["name"] == "Chess"
    assert body["game_type"] == "STRATEGY"


async def test_regular_user_cannot_create_game(client):
    await _register_and_login_user(client)

    resp = await client.post("/api/admin/games", json=VALID_GAME)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_unauthenticated_cannot_create_game(client):
    resp = await client.post("/api/admin/games", json=VALID_GAME)
    assert resp.status_code == 401


async def test_create_duplicate_game_name_rejected(client, db_session):
    await _create_and_login_admin(client, db_session)

    await client.post("/api/admin/games", json=VALID_GAME)
    resp = await client.post("/api/admin/games", json=VALID_GAME)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "GAME_ALREADY_EXISTS"


async def test_list_and_get_game(client, db_session):
    await _create_and_login_admin(client, db_session)
    create_resp = await client.post("/api/admin/games", json=VALID_GAME)
    game_id = create_resp.json()["data"]["id"]

    list_resp = await client.get("/api/games")
    assert list_resp.status_code == 200
    assert len(list_resp.json()["data"]) == 1

    get_resp = await client.get(f"/api/games/{game_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["name"] == "Chess"


async def test_get_nonexistent_game_returns_404(client):
    resp = await client.get("/api/games/999999")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "GAME_NOT_FOUND"


async def test_admin_can_update_game(client, db_session):
    await _create_and_login_admin(client, db_session)
    create_resp = await client.post("/api/admin/games", json=VALID_GAME)
    game_id = create_resp.json()["data"]["id"]

    resp = await client.put(f"/api/admin/games/{game_id}", json={"description": "Updated description"})
    assert resp.status_code == 200
    assert resp.json()["data"]["description"] == "Updated description"
    assert resp.json()["data"]["name"] == "Chess"


async def test_admin_can_delete_game(client, db_session):
    await _create_and_login_admin(client, db_session)
    create_resp = await client.post("/api/admin/games", json=VALID_GAME)
    game_id = create_resp.json()["data"]["id"]

    resp = await client.delete(f"/api/admin/games/{game_id}")
    assert resp.status_code == 204

    get_resp = await client.get(f"/api/games/{game_id}")
    assert get_resp.status_code == 404


async def test_admin_cannot_delete_game_with_tournaments(client, db_session):
    await _create_and_login_admin(client, db_session)
    create_resp = await client.post("/api/admin/games", json=VALID_GAME)
    game_id = create_resp.json()["data"]["id"]

    await tournament_repository.create(
        db_session,
        game_id=game_id,
        name="Chess Open",
        description=None,
        entry_fee="0",
        prize_pool="0",
        max_players=8,
        start_time=datetime.now(timezone.utc) + timedelta(hours=48),
        registration_deadline=datetime.now(timezone.utc) + timedelta(hours=24),
        game_url=None,
        rules=None,
        instructions=None,
    )
    await db_session.commit()

    resp = await client.delete(f"/api/admin/games/{game_id}")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "GAME_IN_USE"
