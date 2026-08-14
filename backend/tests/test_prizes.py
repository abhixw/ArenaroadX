from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.models.tournament import TournamentStatus
from app.models.user import UserRole
from app.repositories import game_repository, tournament_repository, user_repository


async def _make_game(db_session) -> int:
    game = await game_repository.create(
        db_session, name="Smash Karts", description=None, image_url=None, game_type="RACING"
    )
    await db_session.commit()
    return game.id


async def _make_tournament(db_session, game_id: int, **overrides) -> int:
    fields = dict(
        game_id=game_id,
        name="Smash Karts Weekly",
        description=None,
        entry_fee="50",
        prize_pool="2000",
        max_players=10,
        start_time=datetime.now(timezone.utc) + timedelta(hours=48),
        registration_deadline=datetime.now(timezone.utc) + timedelta(hours=24),
        game_url=None,
        rules=None,
        instructions=None,
        status=TournamentStatus.REGISTRATION_OPEN,
    )
    fields.update(overrides)
    tournament = await tournament_repository.create(db_session, **fields)
    await db_session.commit()
    return tournament.id


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


async def _register_user(client, db_session, email: str) -> int:
    await client.post(
        "/api/auth/register",
        json={"name": "Player", "email": email, "password": "StrongPassword123", "phone": "9876543210"},
    )
    user = await user_repository.get_by_email(db_session, email)
    # Settle the read's implicit transaction so the session isn't left open at teardown.
    await db_session.commit()
    return user.id


async def test_admin_can_create_prize(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _register_user(client, db_session, "winner@example.com")

    await _login_admin(client, db_session)
    resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes", json={"user_id": user_id, "rank": 1, "amount": "1000"}
    )
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["rank"] == 1
    assert body["amount"] == "1000.00"
    assert body["payout_status"] == "PENDING"
    assert body["paid_at"] is None


async def test_create_prize_unknown_tournament_404(client, db_session):
    user_id = await _register_user(client, db_session, "w2@example.com")
    await _login_admin(client, db_session)

    resp = await client.post(
        "/api/admin/tournaments/999999/prizes", json={"user_id": user_id, "rank": 1, "amount": "1000"}
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TOURNAMENT_NOT_FOUND"


async def test_create_prize_unknown_user_404(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    await _login_admin(client, db_session)

    resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes", json={"user_id": 999999, "rank": 1, "amount": "1000"}
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "USER_NOT_FOUND"


async def test_regular_user_cannot_create_prize(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _register_user(client, db_session, "w3@example.com")
    await client.post("/api/auth/login", json={"email": "w3@example.com", "password": "StrongPassword123"})

    resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes", json={"user_id": user_id, "rank": 1, "amount": "1000"}
    )
    assert resp.status_code == 403


async def test_admin_can_update_prize(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _register_user(client, db_session, "w4@example.com")

    await _login_admin(client, db_session)
    create_resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes", json={"user_id": user_id, "rank": 1, "amount": "1000"}
    )
    prize_id = create_resp.json()["data"]["id"]

    update_resp = await client.put(f"/api/admin/prizes/{prize_id}", json={"amount": "1500"})
    assert update_resp.status_code == 200
    assert update_resp.json()["data"]["amount"] == "1500.00"


async def test_update_nonexistent_prize_404(client, db_session):
    await _login_admin(client, db_session)
    resp = await client.put("/api/admin/prizes/999999", json={"amount": "500"})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRIZE_NOT_FOUND"


async def test_admin_can_mark_prize_paid(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _register_user(client, db_session, "w5@example.com")

    await _login_admin(client, db_session)
    create_resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes", json={"user_id": user_id, "rank": 1, "amount": "1000"}
    )
    prize_id = create_resp.json()["data"]["id"]

    resp = await client.post(f"/api/admin/prizes/{prize_id}/mark-paid")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["payout_status"] == "PAID"
    assert body["paid_at"] is not None


async def test_mark_paid_nonexistent_prize_404(client, db_session):
    await _login_admin(client, db_session)
    resp = await client.post("/api/admin/prizes/999999/mark-paid")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PRIZE_NOT_FOUND"


async def test_regular_user_cannot_mark_paid(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _register_user(client, db_session, "w6@example.com")

    await _login_admin(client, db_session)
    create_resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes", json={"user_id": user_id, "rank": 1, "amount": "1000"}
    )
    prize_id = create_resp.json()["data"]["id"]
    await client.post("/api/auth/logout")

    await client.post("/api/auth/login", json={"email": "w6@example.com", "password": "StrongPassword123"})
    resp = await client.post(f"/api/admin/prizes/{prize_id}/mark-paid")
    assert resp.status_code == 403


async def test_list_prizes_for_tournament(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user1 = await _register_user(client, db_session, "w7@example.com")
    user2 = await _register_user(client, db_session, "w8@example.com")

    await _login_admin(client, db_session)
    await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes", json={"user_id": user1, "rank": 1, "amount": "1000"}
    )
    await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes", json={"user_id": user2, "rank": 2, "amount": "500"}
    )
    await client.post("/api/auth/logout")

    await client.post("/api/auth/login", json={"email": "w7@example.com", "password": "StrongPassword123"})
    resp = await client.get(f"/api/tournaments/{tournament_id}/prizes")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2
    assert [p["rank"] for p in data] == [1, 2]


async def test_list_prizes_requires_authentication(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)

    resp = await client.get(f"/api/tournaments/{tournament_id}/prizes")
    assert resp.status_code == 401


async def test_list_prizes_unknown_tournament_404(client, db_session):
    await _register_user(client, db_session, "w9@example.com")
    await client.post("/api/auth/login", json={"email": "w9@example.com", "password": "StrongPassword123"})

    resp = await client.get("/api/tournaments/999999/prizes")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TOURNAMENT_NOT_FOUND"
