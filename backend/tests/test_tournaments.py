from datetime import datetime, timedelta, timezone

import pytest

pytestmark = pytest.mark.asyncio


def _future(hours: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


async def _create_game(client) -> str:
    response = await client.post("/api/admin/games", json={"name": "Smash Karts", "game_type": "racing"})
    assert response.status_code == 201
    return response.json()["data"]["id"]


def _tournament_payload(game_id: str) -> dict:
    return {
        "game_id": game_id,
        "name": "Weekend Cup",
        "entry_fee": "50.00",
        "prize_pool": "1000.00",
        "first_prize": "700.00",
        "second_prize": "300.00",
        "max_players": 8,
        "start_time": _future(48),
        "registration_deadline": _future(24),
    }


async def test_create_tournament_requires_admin(client, as_user):
    game_id = "507f1f77bcf86cd799439011"
    response = await client.post(f"/api/admin/games", json={"name": "X"})
    assert response.status_code == 403

    response = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    assert response.status_code == 403


async def test_create_and_fetch_tournament(client, as_admin):
    game_id = await _create_game(client)
    response = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["status"] == "DRAFT"
    # Decimal division normalizes trailing zeros -- 70000 paise / 100 serializes as "700",
    # not "700.00" (see tournament_service._to_rupees).
    assert data["first_prize"] == "700"
    assert data["second_prize"] == "300"

    fetched = await client.get(f"/api/tournaments/{data['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["name"] == "Weekend Cup"


async def test_tournament_lifecycle_transitions(client, as_admin):
    game_id = await _create_game(client)
    created = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    tournament_id = created.json()["data"]["id"]

    opened = await client.post(f"/api/admin/tournaments/{tournament_id}/open-registration")
    assert opened.status_code == 200
    assert opened.json()["data"]["status"] == "REGISTRATION_OPEN"

    closed = await client.post(f"/api/admin/tournaments/{tournament_id}/close-registration")
    assert closed.status_code == 200
    assert closed.json()["data"]["status"] == "REGISTRATION_CLOSED"

    ready = await client.post(f"/api/admin/tournaments/{tournament_id}/mark-ready")
    assert ready.status_code == 200
    assert ready.json()["data"]["status"] == "READY"

    # Out-of-order transition is rejected -- can't reopen registration on a READY tournament.
    invalid = await client.post(f"/api/admin/tournaments/{tournament_id}/open-registration")
    assert invalid.status_code == 400
    assert invalid.json()["error"]["code"] == "INVALID_TOURNAMENT_STATUS"


async def test_cancel_tournament_requires_reason(client, as_admin):
    game_id = await _create_game(client)
    created = await client.post("/api/admin/tournaments", json=_tournament_payload(game_id))
    tournament_id = created.json()["data"]["id"]

    missing_reason = await client.post(f"/api/admin/tournaments/{tournament_id}/cancel", json={"reason": "  "})
    assert missing_reason.status_code == 422

    cancelled = await client.post(f"/api/admin/tournaments/{tournament_id}/cancel", json={"reason": "Not enough players"})
    assert cancelled.status_code == 200
    assert cancelled.json()["data"]["status"] == "CANCELLED"
