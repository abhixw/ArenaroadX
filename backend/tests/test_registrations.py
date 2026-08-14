import asyncio
from datetime import datetime, timedelta, timezone

from httpx import ASGITransport, AsyncClient

from app.core.security import hash_password
from app.main import app
from app.models.registration import RegistrationPaymentStatus, RegistrationStatus
from app.models.tournament import TournamentStatus
from app.models.user import UserRole
from app.repositories import game_repository, registration_repository, tournament_repository, user_repository


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
        max_players=2,
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


async def _register_and_login_user(client, email: str = "player@example.com") -> None:
    await client.post(
        "/api/auth/register",
        json={"name": "Player", "email": email, "password": "StrongPassword123", "phone": "9876543210"},
    )
    await client.post("/api/auth/login", json={"email": email, "password": "StrongPassword123"})


async def _make_and_login_second_user(db_session, client) -> None:
    user = await user_repository.create(
        db_session,
        name="Second",
        email="second@example.com",
        password_hash=hash_password("StrongPassword123"),
        phone="9876500000",
        role=UserRole.USER,
    )
    await db_session.commit()
    await client.post("/api/auth/login", json={"email": user.email, "password": "StrongPassword123"})


async def test_register_success(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    await _register_and_login_user(client)

    resp = await client.post(f"/api/tournaments/{tournament_id}/register")
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["registration_status"] == "PENDING_PAYMENT"
    assert body["payment_status"] == "PENDING"
    assert body["tournament_id"] == tournament_id


async def test_register_unauthenticated_rejected(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)

    resp = await client.post(f"/api/tournaments/{tournament_id}/register")
    assert resp.status_code == 401


async def test_register_nonexistent_tournament_404(client):
    await _register_and_login_user(client)
    resp = await client.post("/api/tournaments/999999/register")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TOURNAMENT_NOT_FOUND"


async def test_register_duplicate_rejected(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    await _register_and_login_user(client)

    resp1 = await client.post(f"/api/tournaments/{tournament_id}/register")
    assert resp1.status_code == 201

    resp2 = await client.post(f"/api/tournaments/{tournament_id}/register")
    assert resp2.status_code == 409
    assert resp2.json()["error"]["code"] == "ALREADY_REGISTERED"


async def test_register_closed_tournament_rejected(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id, status=TournamentStatus.DRAFT)
    await _register_and_login_user(client)

    resp = await client.post(f"/api/tournaments/{tournament_id}/register")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "TOURNAMENT_CLOSED"


async def test_register_after_deadline_rejected(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(
        db_session,
        game_id,
        start_time=datetime.now(timezone.utc) + timedelta(hours=1),
        registration_deadline=datetime.now(timezone.utc) - timedelta(minutes=5),
    )
    await _register_and_login_user(client)

    resp = await client.post(f"/api/tournaments/{tournament_id}/register")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "REGISTRATION_DEADLINE_PASSED"


async def test_register_full_tournament_rejected(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id, max_players=1)
    await _register_and_login_user(client, email="first@example.com")

    resp1 = await client.post(f"/api/tournaments/{tournament_id}/register")
    assert resp1.status_code == 201

    await _make_and_login_second_user(db_session, client)
    resp2 = await client.post(f"/api/tournaments/{tournament_id}/register")
    assert resp2.status_code == 409
    assert resp2.json()["error"]["code"] == "TOURNAMENT_FULL"


async def test_my_tournaments_list_and_get(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    await _register_and_login_user(client)
    await client.post(f"/api/tournaments/{tournament_id}/register")

    list_resp = await client.get("/api/my-tournaments")
    assert list_resp.status_code == 200
    data = list_resp.json()["data"]
    assert len(data) == 1
    assert data[0]["tournament"]["id"] == tournament_id
    assert data[0]["registration_status"] == "PENDING_PAYMENT"

    get_resp = await client.get(f"/api/my-tournaments/{tournament_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["tournament"]["id"] == tournament_id


async def test_my_tournaments_requires_auth(client):
    resp = await client.get("/api/my-tournaments")
    assert resp.status_code == 401


async def test_get_my_tournament_not_registered_404(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    await _register_and_login_user(client)

    resp = await client.get(f"/api/my-tournaments/{tournament_id}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "REGISTRATION_NOT_FOUND"


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


async def test_list_tournament_players_only_shows_confirmed(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id, max_players=5)

    await _register_and_login_user(client, email="confirmed@example.com")
    await client.post(f"/api/tournaments/{tournament_id}/register")
    confirmed_reg = await registration_repository.get_by_user_and_tournament(
        db_session, (await user_repository.get_by_email(db_session, "confirmed@example.com")).id, tournament_id
    )
    await registration_repository.update(
        db_session,
        confirmed_reg,
        registration_status=RegistrationStatus.CONFIRMED,
        payment_status=RegistrationPaymentStatus.CAPTURED,
    )
    await db_session.commit()

    await client.post("/api/auth/logout")
    await _register_and_login_user(client, email="pending@example.com")
    await client.post(f"/api/tournaments/{tournament_id}/register")

    await client.post("/api/auth/logout")
    await _login_admin(client, db_session)

    resp = await client.get(f"/api/admin/tournaments/{tournament_id}/players")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["email"] == "confirmed@example.com"
    assert data[0]["registration_status"] == "CONFIRMED"
    assert data[0]["payment_status"] == "CAPTURED"


async def test_list_tournament_players_requires_admin(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    await _register_and_login_user(client)

    resp = await client.get(f"/api/admin/tournaments/{tournament_id}/players")
    assert resp.status_code == 403


async def test_list_tournament_players_unknown_tournament_404(client, db_session):
    await _login_admin(client, db_session)
    resp = await client.get("/api/admin/tournaments/999999/players")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TOURNAMENT_NOT_FOUND"


async def test_admin_player_history(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)

    await _register_and_login_user(client, email="history@example.com")
    await client.post(f"/api/tournaments/{tournament_id}/register")
    user = await user_repository.get_by_email(db_session, "history@example.com")

    await client.post("/api/auth/logout")
    await _login_admin(client, db_session)

    resp = await client.get(f"/api/admin/players/{user.id}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["user"]["email"] == "history@example.com"
    assert len(data["registrations"]) == 1
    assert data["registrations"][0]["tournament"]["id"] == tournament_id


async def test_admin_player_history_unknown_user_404(client, db_session):
    await _login_admin(client, db_session)
    resp = await client.get("/api/admin/players/999999")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "USER_NOT_FOUND"


async def test_admin_player_history_requires_admin(client, db_session):
    await _register_and_login_user(client)
    user = await user_repository.get_by_email(db_session, "player@example.com")
    # Settle the read's implicit transaction so the session isn't left open at teardown.
    await db_session.commit()

    resp = await client.get(f"/api/admin/players/{user.id}")
    assert resp.status_code == 403


async def test_concurrent_registrations_do_not_overbook(client, db_session):
    # `client` fixture already installed the test-DB dependency override on `app`;
    # these extra clients reuse the same app/override so this exercises real
    # concurrent transactions against Postgres, not just sequential calls.
    game_id = await _make_game(db_session)
    max_players = 3
    tournament_id = await _make_tournament(db_session, game_id, max_players=max_players)

    num_users = 8
    clients = []
    for i in range(num_users):
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        email = f"race{i}@example.com"
        await c.post(
            "/api/auth/register",
            json={"name": f"Racer {i}", "email": email, "password": "StrongPassword123", "phone": "9876543210"},
        )
        await c.post("/api/auth/login", json={"email": email, "password": "StrongPassword123"})
        clients.append(c)

    try:
        results = await asyncio.gather(
            *[c.post(f"/api/tournaments/{tournament_id}/register") for c in clients]
        )
    finally:
        await asyncio.gather(*[c.aclose() for c in clients])

    status_codes = [r.status_code for r in results]
    assert status_codes.count(201) == max_players
    assert status_codes.count(409) == num_users - max_players
