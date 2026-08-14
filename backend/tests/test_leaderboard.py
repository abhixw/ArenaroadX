from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.models.registration import RegistrationPaymentStatus, RegistrationStatus
from app.models.result import ResultStatus
from app.models.tournament import TournamentStatus
from app.models.user import UserRole
from app.repositories import (
    game_repository,
    registration_repository,
    result_repository,
    tournament_repository,
    user_repository,
)


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


async def _make_confirmed_participant(client, db_session, tournament_id: int, email: str, name: str) -> int:
    await client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": "StrongPassword123", "phone": "9876543210"},
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


async def test_leaderboard_only_shows_published_results(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    rahul_id = await _make_confirmed_participant(client, db_session, tournament_id, "rahul@example.com", "Rahul")
    abhinav_id = await _make_confirmed_participant(
        client, db_session, tournament_id, "abhinav@example.com", "Abhinav"
    )

    await _login_admin(client, db_session)
    await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": rahul_id, "score": 95, "rank": 1},
    )
    await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": abhinav_id, "score": 88, "rank": 2},
    )
    # Only publish Rahul's result; Abhinav's stays DRAFT.
    rahul_result = await client.get(f"/api/tournaments/{tournament_id}/results")  # still empty pre-publish
    assert rahul_result.json()["data"] == []

    draft_result = await result_repository.get_by_tournament_and_user(db_session, tournament_id, rahul_id)
    await result_repository.update(db_session, draft_result, status=ResultStatus.PUBLISHED)
    await db_session.commit()
    await client.post("/api/auth/logout")

    await client.post("/api/auth/login", json={"email": "rahul@example.com", "password": "StrongPassword123"})
    resp = await client.get(f"/api/tournaments/{tournament_id}/leaderboard")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["tournament_id"] == tournament_id
    assert len(body["entries"]) == 1
    assert body["entries"][0]["user_id"] == rahul_id
    assert body["entries"][0]["player_name"] == "Rahul"
    assert body["entries"][0]["score"] == 95


async def test_leaderboard_correct_ordering(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    rahul_id = await _make_confirmed_participant(client, db_session, tournament_id, "rahul2@example.com", "Rahul")
    abhinav_id = await _make_confirmed_participant(
        client, db_session, tournament_id, "abhinav2@example.com", "Abhinav"
    )

    await _login_admin(client, db_session)
    await client.post(
        f"/api/admin/tournaments/{tournament_id}/results", json={"user_id": abhinav_id, "score": 88, "rank": 2}
    )
    await client.post(
        f"/api/admin/tournaments/{tournament_id}/results", json={"user_id": rahul_id, "score": 95, "rank": 1}
    )
    await client.post(f"/api/admin/tournaments/{tournament_id}/publish-results")
    await client.post("/api/auth/logout")

    await client.post("/api/auth/login", json={"email": "rahul2@example.com", "password": "StrongPassword123"})
    resp = await client.get(f"/api/tournaments/{tournament_id}/leaderboard")
    entries = resp.json()["data"]["entries"]
    assert [e["rank"] for e in entries] == [1, 2]
    assert entries[0]["user_id"] == rahul_id
    assert entries[1]["user_id"] == abhinav_id


async def test_leaderboard_requires_authentication(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)

    resp = await client.get(f"/api/tournaments/{tournament_id}/leaderboard")
    assert resp.status_code == 401


async def test_leaderboard_unknown_tournament_404(client, db_session):
    await client.post(
        "/api/auth/register",
        json={"name": "X", "email": "x@example.com", "password": "StrongPassword123", "phone": "9876543210"},
    )
    await client.post("/api/auth/login", json={"email": "x@example.com", "password": "StrongPassword123"})

    resp = await client.get("/api/tournaments/999999/leaderboard")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TOURNAMENT_NOT_FOUND"


async def test_user_leaderboard_history(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id, name="History Cup")
    user_id = await _make_confirmed_participant(client, db_session, tournament_id, "history@example.com", "Hist")

    await _login_admin(client, db_session)
    await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": user_id, "score": 77, "rank": 3},
    )
    await client.post(f"/api/admin/tournaments/{tournament_id}/publish-results")
    await client.post("/api/auth/logout")

    await client.post("/api/auth/login", json={"email": "history@example.com", "password": "StrongPassword123"})
    resp = await client.get("/api/users/me/leaderboard-history")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["tournament_id"] == tournament_id
    assert data[0]["tournament_name"] == "History Cup"
    assert data[0]["rank"] == 3
    assert data[0]["score"] == 77


async def test_user_leaderboard_history_excludes_drafts(client, db_session):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    user_id = await _make_confirmed_participant(client, db_session, tournament_id, "draftuser@example.com", "D")

    await _login_admin(client, db_session)
    await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": user_id, "score": 50, "rank": 1},
    )
    await client.post("/api/auth/logout")

    await client.post("/api/auth/login", json={"email": "draftuser@example.com", "password": "StrongPassword123"})
    resp = await client.get("/api/users/me/leaderboard-history")
    assert resp.status_code == 200
    assert resp.json()["data"] == []


async def test_user_leaderboard_history_requires_authentication(client):
    resp = await client.get("/api/users/me/leaderboard-history")
    assert resp.status_code == 401
