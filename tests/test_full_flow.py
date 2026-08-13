"""End-to-end verification of the complete MVP flow described in the spec:

Register -> Login -> Admin creates game -> Admin creates tournament -> User views
tournament -> User registers -> Payment order created -> Payment verified ->
Registration confirmed -> Admin sees participant -> Admin enters result -> Admin
publishes result -> User sees leaderboard -> Admin creates prize -> Admin marks
prize paid.
"""

from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.models.user import UserRole
from app.repositories import user_repository
from app.services import payment_service
from tests.test_payments import FakeRazorpayClient


async def test_complete_tournament_lifecycle(client, db_session, monkeypatch):
    # 1. Register
    register_resp = await client.post(
        "/api/auth/register",
        json={
            "name": "Rahul",
            "email": "rahul.flow@example.com",
            "password": "StrongPassword123",
            "phone": "9876543210",
        },
    )
    assert register_resp.status_code == 201
    assert register_resp.json()["data"]["role"] == "USER"

    # 2. Login
    login_resp = await client.post(
        "/api/auth/login", json={"email": "rahul.flow@example.com", "password": "StrongPassword123"}
    )
    assert login_resp.status_code == 200
    me_resp = await client.get("/api/auth/me")
    assert me_resp.status_code == 200
    user_id = me_resp.json()["data"]["id"]
    await client.post("/api/auth/logout")

    # Admin account: created directly via repository, exactly as the real deployment
    # would via scripts/create_admin.py -- never through a public endpoint.
    admin = await user_repository.create(
        db_session,
        name="Admin",
        email="admin.flow@example.com",
        password_hash=hash_password("AdminPass123"),
        phone="9999999999",
        role=UserRole.ADMIN,
    )
    await db_session.commit()
    admin_login_resp = await client.post(
        "/api/auth/login", json={"email": admin.email, "password": "AdminPass123"}
    )
    assert admin_login_resp.status_code == 200
    assert admin_login_resp.json()["data"]["role"] == "ADMIN"

    # 3. Admin creates game
    game_resp = await client.post(
        "/api/admin/games",
        json={"name": "BGMI", "description": "Battle royale", "game_type": "BATTLE_ROYALE"},
    )
    assert game_resp.status_code == 201
    game_id = game_resp.json()["data"]["id"]

    # 4. Admin creates tournament (starts DRAFT)
    start_time = (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()
    deadline = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    tournament_resp = await client.post(
        "/api/admin/tournaments",
        json={
            "game_id": game_id,
            "name": "BGMI Squad Showdown",
            "description": "Weekly squad tournament",
            "entry_fee": "50",
            "prize_pool": "2000",
            "max_players": 100,
            "start_time": start_time,
            "registration_deadline": deadline,
            "game_url": "https://example.com/bgmi",
            "rules": "No cheating",
            "instructions": "Join 10 minutes before the tournament",
        },
    )
    assert tournament_resp.status_code == 201
    tournament_id = tournament_resp.json()["data"]["id"]
    assert tournament_resp.json()["data"]["status"] == "DRAFT"

    # Admin opens registration
    open_resp = await client.put(
        f"/api/admin/tournaments/{tournament_id}", json={"status": "REGISTRATION_OPEN"}
    )
    assert open_resp.status_code == 200
    assert open_resp.json()["data"]["status"] == "REGISTRATION_OPEN"
    await client.post("/api/auth/logout")

    # 5. User views tournament
    await client.post("/api/auth/login", json={"email": "rahul.flow@example.com", "password": "StrongPassword123"})
    view_resp = await client.get(f"/api/tournaments/{tournament_id}")
    assert view_resp.status_code == 200
    assert view_resp.json()["data"]["status"] == "REGISTRATION_OPEN"

    # 6. User registers
    register_tournament_resp = await client.post(f"/api/tournaments/{tournament_id}/register")
    assert register_tournament_resp.status_code == 201
    assert register_tournament_resp.json()["data"]["registration_status"] == "PENDING_PAYMENT"

    # 7. Create Razorpay order (mocked -- never a real Razorpay API call)
    monkeypatch.setattr(payment_service, "_client", lambda: FakeRazorpayClient(order_id="order_flow_test"))
    order_resp = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})
    assert order_resp.status_code == 201
    order_body = order_resp.json()["data"]
    assert order_body["amount"] == 5000  # entry_fee 50.00 -> paise
    assert order_body["order_id"] == "order_flow_test"

    # 8. Verify payment (mocked valid signature)
    verify_resp = await client.post(
        "/api/payments/verify",
        json={
            "razorpay_order_id": "order_flow_test",
            "razorpay_payment_id": "pay_flow_test",
            "razorpay_signature": "sig_flow_test",
        },
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["data"]["status"] == "CAPTURED"

    # 9. Registration confirmed
    my_tournament_resp = await client.get(f"/api/my-tournaments/{tournament_id}")
    assert my_tournament_resp.status_code == 200
    assert my_tournament_resp.json()["data"]["registration_status"] == "CONFIRMED"
    assert my_tournament_resp.json()["data"]["payment_status"] == "CAPTURED"
    await client.post("/api/auth/logout")

    # Admin runs the tournament through its remaining lifecycle before entering results.
    await client.post("/api/auth/login", json={"email": admin.email, "password": "AdminPass123"})
    close_resp = await client.post(f"/api/admin/tournaments/{tournament_id}/close")
    assert close_resp.json()["data"]["status"] == "REGISTRATION_CLOSED"
    start_resp = await client.post(f"/api/admin/tournaments/{tournament_id}/start")
    assert start_resp.json()["data"]["status"] == "LIVE"

    # 10. Admin sees participant (only confirmed registrations count)
    players_resp = await client.get(f"/api/admin/tournaments/{tournament_id}/players")
    assert players_resp.status_code == 200
    players = players_resp.json()["data"]
    assert len(players) == 1
    assert players[0]["user_id"] == user_id
    assert players[0]["email"] == "rahul.flow@example.com"
    assert players[0]["registration_status"] == "CONFIRMED"

    complete_resp = await client.post(f"/api/admin/tournaments/{tournament_id}/complete")
    assert complete_resp.json()["data"]["status"] == "COMPLETED"

    # 11. Admin enters result
    result_resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/results",
        json={"user_id": user_id, "score": 95, "rank": 1, "result_data": {"kills": 8, "placement": 2, "points": 95}},
    )
    assert result_resp.status_code == 201
    assert result_resp.json()["data"]["status"] == "DRAFT"

    # 12. Admin publishes result
    publish_resp = await client.post(f"/api/admin/tournaments/{tournament_id}/publish-results")
    assert publish_resp.status_code == 200
    assert publish_resp.json()["data"][0]["status"] == "PUBLISHED"

    # 13. Admin creates prize
    prize_resp = await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes",
        json={"user_id": user_id, "rank": 1, "amount": "1000"},
    )
    assert prize_resp.status_code == 201
    prize_id = prize_resp.json()["data"]["id"]
    assert prize_resp.json()["data"]["payout_status"] == "PENDING"

    # 14. Admin marks prize paid
    mark_paid_resp = await client.post(f"/api/admin/prizes/{prize_id}/mark-paid")
    assert mark_paid_resp.status_code == 200
    assert mark_paid_resp.json()["data"]["payout_status"] == "PAID"
    assert mark_paid_resp.json()["data"]["paid_at"] is not None
    await client.post("/api/auth/logout")

    # 15. User sees leaderboard and their published result
    await client.post("/api/auth/login", json={"email": "rahul.flow@example.com", "password": "StrongPassword123"})
    leaderboard_resp = await client.get(f"/api/tournaments/{tournament_id}/leaderboard")
    assert leaderboard_resp.status_code == 200
    entries = leaderboard_resp.json()["data"]["entries"]
    assert len(entries) == 1
    assert entries[0]["rank"] == 1
    assert entries[0]["user_id"] == user_id
    assert entries[0]["player_name"] == "Rahul"
    assert entries[0]["score"] == 95

    history_resp = await client.get("/api/users/me/leaderboard-history")
    assert history_resp.status_code == 200
    assert history_resp.json()["data"][0]["tournament_id"] == tournament_id

    results_resp = await client.get(f"/api/tournaments/{tournament_id}/results")
    assert results_resp.status_code == 200
    assert results_resp.json()["data"][0]["status"] == "PUBLISHED"

    prizes_resp = await client.get(f"/api/tournaments/{tournament_id}/prizes")
    assert prizes_resp.status_code == 200
    assert prizes_resp.json()["data"][0]["payout_status"] == "PAID"
