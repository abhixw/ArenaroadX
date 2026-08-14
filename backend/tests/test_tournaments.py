from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.models.user import UserRole
from app.repositories import game_repository, user_repository


def _future(hours: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def _tournament_payload(game_id: int, **overrides) -> dict:
    payload = {
        "game_id": game_id,
        "name": "Smash Karts Weekly Championship",
        "description": "Weekly Smash Karts tournament",
        "entry_fee": "50",
        "prize_pool": "2000",
        "max_players": 100,
        "start_time": _future(48),
        "registration_deadline": _future(24),
        "game_url": "https://example.com/game",
        "rules": "No cheating",
        "instructions": "Join 10 minutes before the tournament",
    }
    payload.update(overrides)
    return payload


async def _login_admin(client, db_session):
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
    return admin


async def _make_game(db_session) -> int:
    game = await game_repository.create(
        db_session, name="Smash Karts", description=None, image_url=None, game_type="RACING"
    )
    await db_session.commit()
    return game.id


async def test_create_tournament_starts_in_draft(client, db_session):
    await _login_admin(client, db_session)
    game_id = await _make_game(db_session)

    resp = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["status"] == "DRAFT"
    assert body["game_id"] == game_id


async def test_create_tournament_unknown_game_returns_404(client, db_session):
    await _login_admin(client, db_session)

    resp = await client.post("/api/admin/tournaments", json=_tournament_payload(999999))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "GAME_NOT_FOUND"


async def test_create_tournament_rejects_deadline_after_start(client, db_session):
    await _login_admin(client, db_session)
    game_id = await _make_game(db_session)

    payload = _tournament_payload(game_id, start_time=_future(10), registration_deadline=_future(20))
    resp = await client.post("/api/admin/tournaments", json=payload)
    assert resp.status_code == 422


async def test_create_tournament_rejects_negative_entry_fee(client, db_session):
    await _login_admin(client, db_session)
    game_id = await _make_game(db_session)

    payload = _tournament_payload(game_id, entry_fee="-10")
    resp = await client.post("/api/admin/tournaments", json=payload)
    assert resp.status_code == 422


async def test_regular_user_cannot_create_tournament(client, db_session):
    game_id = await _make_game(db_session)
    await client.post(
        "/api/auth/register",
        json={"name": "P", "email": "p@example.com", "password": "StrongPassword123", "phone": "9876543210"},
    )
    await client.post("/api/auth/login", json={"email": "p@example.com", "password": "StrongPassword123"})

    resp = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    assert resp.status_code == 403


async def test_list_and_get_tournament(client, db_session):
    await _login_admin(client, db_session)
    game_id = await _make_game(db_session)
    create_resp = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    tournament_id = create_resp.json()["data"]["id"]

    list_resp = await client.get("/api/tournaments")
    assert list_resp.status_code == 200
    assert len(list_resp.json()["data"]) == 1

    filtered_resp = await client.get(f"/api/tournaments?game_id={game_id}")
    assert len(filtered_resp.json()["data"]) == 1

    filtered_status_resp = await client.get("/api/tournaments?status=REGISTRATION_OPEN")
    assert filtered_status_resp.json()["data"] == []

    get_resp = await client.get(f"/api/tournaments/{tournament_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["name"] == "Smash Karts Weekly Championship"


async def test_get_nonexistent_tournament_404(client):
    resp = await client.get("/api/tournaments/999999")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TOURNAMENT_NOT_FOUND"


async def test_upcoming_tournaments_excludes_cancelled(client, db_session):
    await _login_admin(client, db_session)
    game_id = await _make_game(db_session)
    create_resp = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    tournament_id = create_resp.json()["data"]["id"]

    upcoming_resp = await client.get("/api/tournaments/upcoming")
    assert len(upcoming_resp.json()["data"]) == 1

    # DRAFT -> REGISTRATION_OPEN -> CANCELLED
    await client.put(f"/api/admin/tournaments/{tournament_id}", json={"status": "REGISTRATION_OPEN"})
    await client.post(f"/api/admin/tournaments/{tournament_id}/cancel")

    upcoming_resp_after = await client.get("/api/tournaments/upcoming")
    assert upcoming_resp_after.json()["data"] == []


async def test_full_valid_status_lifecycle(client, db_session):
    await _login_admin(client, db_session)
    game_id = await _make_game(db_session)
    create_resp = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    tournament_id = create_resp.json()["data"]["id"]

    r1 = await client.put(f"/api/admin/tournaments/{tournament_id}", json={"status": "REGISTRATION_OPEN"})
    assert r1.json()["data"]["status"] == "REGISTRATION_OPEN"

    r2 = await client.post(f"/api/admin/tournaments/{tournament_id}/close")
    assert r2.json()["data"]["status"] == "REGISTRATION_CLOSED"

    r3 = await client.post(f"/api/admin/tournaments/{tournament_id}/start")
    assert r3.json()["data"]["status"] == "LIVE"

    r4 = await client.post(f"/api/admin/tournaments/{tournament_id}/complete")
    assert r4.json()["data"]["status"] == "COMPLETED"


async def test_invalid_status_transition_rejected(client, db_session):
    await _login_admin(client, db_session)
    game_id = await _make_game(db_session)
    create_resp = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    tournament_id = create_resp.json()["data"]["id"]

    # DRAFT -> LIVE is not allowed
    resp = await client.post(f"/api/admin/tournaments/{tournament_id}/start")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_TOURNAMENT_STATUS"


async def test_cannot_close_a_tournament_that_is_not_open(client, db_session):
    await _login_admin(client, db_session)
    game_id = await _make_game(db_session)
    create_resp = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    tournament_id = create_resp.json()["data"]["id"]

    resp = await client.post(f"/api/admin/tournaments/{tournament_id}/close")
    assert resp.status_code == 400


async def test_update_tournament_fields(client, db_session):
    await _login_admin(client, db_session)
    game_id = await _make_game(db_session)
    create_resp = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    tournament_id = create_resp.json()["data"]["id"]

    resp = await client.put(f"/api/admin/tournaments/{tournament_id}", json={"prize_pool": "5000"})
    assert resp.status_code == 200
    assert resp.json()["data"]["prize_pool"] == "5000.00"
