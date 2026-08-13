from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
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


async def _make_confirmed_participant(client, db_session, tournament_id: int, email: str) -> int:
    await client.post(
        "/api/auth/register",
        json={"name": "Player", "email": email, "password": "StrongPassword123", "phone": "9876543210"},
    )
    await client.post("/api/auth/login", json={"email": email, "password": "StrongPassword123"})
    await client.post(f"/api/tournaments/{tournament_id}/register")
    user = await user_repository.get_by_email(db_session, email)
    registration = await registration_repository.get_by_user_and_tournament(db_session, user.id, tournament_id)
    await registration_repository.update(
        db_session,
        registration,
        registration_status=RegistrationStatus.CONFIRMED,
        payment_status=RegistrationPaymentStatus.CAPTURED,
    )
    await db_session.commit()
    await client.post("/api/auth/logout")
    return user.id


RESULT_DATA = {"kills": 8, "placement": 2, "points": 95}


async def test_admin_can_create_result_for_confirmed_participant(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _make_confirmed_participant(client, db_session, tournament_id, "player1@example.com")

    await _login_admin(client, db_session)
    resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": user_id, "score": 95, "rank": 1, "result_data": RESULT_DATA},
    )
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["status"] == "DRAFT"
    assert body["rank"] == 1
    assert body["result_data"] == RESULT_DATA


async def test_create_result_for_non_participant_rejected(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    await _login_admin(client, db_session)

    resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": 999999, "score": 95, "rank": 1},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "NOT_A_CONFIRMED_PARTICIPANT"


async def test_create_result_for_unconfirmed_registration_rejected(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    await client.post(
        "/api/auth/register",
        json={"name": "P", "email": "pend@example.com", "password": "StrongPassword123", "phone": "9876543210"},
    )
    await client.post("/api/auth/login", json={"email": "pend@example.com", "password": "StrongPassword123"})
    await client.post(f"/api/tournaments/{tournament_id}/register")
    user = await user_repository.get_by_email(db_session, "pend@example.com")
    await client.post("/api/auth/logout")

    await _login_admin(client, db_session)
    resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": user.id, "score": 95, "rank": 1},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "NOT_A_CONFIRMED_PARTICIPANT"


async def test_create_duplicate_result_rejected(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _make_confirmed_participant(client, db_session, tournament_id, "player2@example.com")

    await _login_admin(client, db_session)
    payload = {"user_id": user_id, "score": 95, "rank": 1, "result_data": RESULT_DATA}
    resp1 = await client.post(f"/api/admin/tournaments/{tournament_id}/results", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post(f"/api/admin/tournaments/{tournament_id}/results", json=payload)
    assert resp2.status_code == 409
    assert resp2.json()["error"]["code"] == "RESULT_ALREADY_EXISTS"


async def test_regular_user_cannot_create_result(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _make_confirmed_participant(client, db_session, tournament_id, "player3@example.com")

    await client.post("/api/auth/login", json={"email": "player3@example.com", "password": "StrongPassword123"})
    resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": user_id, "score": 95, "rank": 1},
    )
    assert resp.status_code == 403


async def test_admin_can_update_result(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _make_confirmed_participant(client, db_session, tournament_id, "player4@example.com")

    await _login_admin(client, db_session)
    create_resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": user_id, "score": 95, "rank": 1, "result_data": RESULT_DATA},
    )
    result_id = create_resp.json()["data"]["id"]

    update_resp = await client.put(f"/api/admin/results/{result_id}", json={"score": 100, "rank": 1})
    assert update_resp.status_code == 200
    assert update_resp.json()["data"]["score"] == 100


async def test_update_nonexistent_result_404(client, db_session):
    await _login_admin(client, db_session)
    resp = await client.put("/api/admin/results/999999", json={"score": 50})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "RESULT_NOT_FOUND"


async def test_user_cannot_see_draft_results(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _make_confirmed_participant(client, db_session, tournament_id, "player5@example.com")

    await _login_admin(client, db_session)
    await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": user_id, "score": 95, "rank": 1, "result_data": RESULT_DATA},
    )
    await client.post("/api/auth/logout")

    await client.post("/api/auth/login", json={"email": "player5@example.com", "password": "StrongPassword123"})
    resp = await client.get(f"/api/tournaments/{tournament_id}/results")
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_publish_results_makes_them_visible(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _make_confirmed_participant(client, db_session, tournament_id, "player6@example.com")

    await _login_admin(client, db_session)
    await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": user_id, "score": 95, "rank": 1, "result_data": RESULT_DATA},
    )
    publish_resp = await client.post(f"/api/admin/tournaments/{tournament_id}/publish-results")
    assert publish_resp.status_code == 200
    assert publish_resp.json()["data"][0]["status"] == "PUBLISHED"
    await client.post("/api/auth/logout")

    await client.post("/api/auth/login", json={"email": "player6@example.com", "password": "StrongPassword123"})
    resp = await client.get(f"/api/tournaments/{tournament_id}/results")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["status"] == "PUBLISHED"
    assert data[0]["user_id"] == user_id


async def test_results_require_authentication(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)

    resp = await client.get(f"/api/tournaments/{tournament_id}/results")
    assert resp.status_code == 401


async def test_results_unknown_tournament_404(client, db_session):
    await client.post(
        "/api/auth/register",
        json={"name": "X", "email": "x@example.com", "password": "StrongPassword123", "phone": "9876543210"},
    )
    await client.post("/api/auth/login", json={"email": "x@example.com", "password": "StrongPassword123"})

    resp = await client.get("/api/tournaments/999999/results")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TOURNAMENT_NOT_FOUND"
