from datetime import datetime, timedelta, timezone

import pytest

from app.integrations.base import PlayerNotFoundError, VerifiedProfile
from tests.conftest import login_as

pytestmark = pytest.mark.asyncio


def _future(hours: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


async def _create_chess_tournament(client) -> tuple[str, str]:
    """Caller must already be logged in as admin -- creates the game/tournament, then leaves
    the client's session as-is (caller switches to a player session afterward)."""
    game = await client.post(
        "/api/admin/games", json={"name": "Chess.com", "game_type": "chess", "integration_key": "chess_com"}
    )
    assert game.status_code == 201
    game_id = game.json()["data"]["id"]
    assert game.json()["data"]["integration_key"] == "chess_com"

    tournament = await client.post(
        "/api/admin/tournaments",
        json={
            "game_id": game_id,
            "name": "Chess.com Open",
            "entry_fee": "0",
            "prize_pool": "500.00",
            "max_players": 8,
            "start_time": _future(48),
            "registration_deadline": _future(24),
        },
    )
    assert tournament.status_code == 201
    return game_id, tournament.json()["data"]["id"]


async def test_verify_requires_a_saved_game_account_first(client, as_admin, user_factory):
    _, tournament_id = await _create_chess_tournament(client)
    player = await user_factory(email="player1@example.com")
    await login_as(client, player)

    response = await client.post(f"/api/tournaments/{tournament_id}/game-account/verify")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "GAME_ACCOUNT_REQUIRED"


async def test_verify_rejects_games_without_an_integration(client, as_admin, user_factory):
    game = await client.post("/api/admin/games", json={"name": "Smash Karts"})
    tournament = await client.post(
        "/api/admin/tournaments",
        json={
            "game_id": game.json()["data"]["id"],
            "name": "Smash Cup",
            "entry_fee": "0",
            "prize_pool": "0",
            "max_players": 8,
            "start_time": _future(48),
            "registration_deadline": _future(24),
        },
    )
    tournament_id = tournament.json()["data"]["id"]

    player = await user_factory(email="player2@example.com")
    await login_as(client, player)
    await client.post(f"/api/tournaments/{tournament_id}/game-account", json={"game_uid": "SomePlayer"})

    response = await client.post(f"/api/tournaments/{tournament_id}/game-account/verify")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INTEGRATION_NOT_SUPPORTED"


async def test_verify_success_stores_provider_profile(client, as_admin, user_factory, monkeypatch):
    _, tournament_id = await _create_chess_tournament(client)
    player = await user_factory(email="player3@example.com")
    await login_as(client, player)
    await client.post(f"/api/tournaments/{tournament_id}/game-account", json={"game_uid": "Hikaru"})

    async def fake_verify_account(self, uid):
        assert uid == "Hikaru"
        return VerifiedProfile(
            provider_player_id="15448422", display_name="Hikaru Nakamura", avatar_url="https://x/a.png", raw={"title": "GM"}
        )

    monkeypatch.setattr("app.integrations.chess_com.ChessComIntegration.verify_account", fake_verify_account)

    response = await client.post(f"/api/tournaments/{tournament_id}/game-account/verify")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["verified_at"] is not None
    assert data["provider_player_id"] == "15448422"
    assert data["provider_data"] == {"title": "GM"}
    assert data["game_username"] == "Hikaru Nakamura"


async def test_verify_invalid_username_returns_404(client, as_admin, user_factory, monkeypatch):
    _, tournament_id = await _create_chess_tournament(client)
    player = await user_factory(email="player4@example.com")
    await login_as(client, player)
    await client.post(f"/api/tournaments/{tournament_id}/game-account", json={"game_uid": "nobody12345xyz"})

    async def fake_verify_account(self, uid):
        raise PlayerNotFoundError(uid)

    monkeypatch.setattr("app.integrations.chess_com.ChessComIntegration.verify_account", fake_verify_account)

    response = await client.post(f"/api/tournaments/{tournament_id}/game-account/verify")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PROVIDER_PLAYER_NOT_FOUND"


async def test_changing_game_uid_clears_stale_verification(client, as_admin, user_factory, monkeypatch):
    _, tournament_id = await _create_chess_tournament(client)
    player = await user_factory(email="player5@example.com")
    await login_as(client, player)
    await client.post(f"/api/tournaments/{tournament_id}/game-account", json={"game_uid": "Hikaru"})

    async def fake_verify_account(self, uid):
        return VerifiedProfile(provider_player_id="1", display_name="Hikaru", avatar_url=None, raw={})

    monkeypatch.setattr("app.integrations.chess_com.ChessComIntegration.verify_account", fake_verify_account)
    verified = await client.post(f"/api/tournaments/{tournament_id}/game-account/verify")
    assert verified.json()["data"]["verified_at"] is not None

    changed = await client.post(f"/api/tournaments/{tournament_id}/game-account", json={"game_uid": "SomeoneElse"})

    assert changed.json()["data"]["verified_at"] is None
    assert changed.json()["data"]["provider_player_id"] is None


async def test_admin_provider_stats_endpoint(client, as_admin, user_factory, monkeypatch):
    _, tournament_id = await _create_chess_tournament(client)
    player = await user_factory(email="player6@example.com")
    await login_as(client, player)
    upsert = await client.post(f"/api/tournaments/{tournament_id}/game-account", json={"game_uid": "Hikaru"})
    game_account_id = upsert.json()["data"]["id"]

    async def fake_verify_account(self, uid):
        return VerifiedProfile(provider_player_id="1", display_name="Hikaru", avatar_url=None, raw={})

    async def fake_get_stats(self, uid):
        return {"chess_rapid": {"last": {"rating": 2800}}}

    monkeypatch.setattr("app.integrations.chess_com.ChessComIntegration.verify_account", fake_verify_account)
    monkeypatch.setattr("app.integrations.chess_com.ChessComIntegration.get_stats", fake_get_stats)
    await client.post(f"/api/tournaments/{tournament_id}/game-account/verify")

    # Switch back to the admin session for the admin-only stats lookup.
    await login_as(client, as_admin)
    response = await client.get(f"/api/admin/game-accounts/{game_account_id}/provider-stats")

    assert response.status_code == 200
    assert response.json()["data"]["chess_rapid"]["last"]["rating"] == 2800
