from datetime import datetime, timedelta, timezone

import pytest

from app.models.game_account import GameAccount
from app.models.registration import Registration, RegistrationPaymentStatus, RegistrationStatus

pytestmark = pytest.mark.asyncio


def _future(hours: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


async def _setup_tournament_with_two_confirmed_players(client, as_admin, user_factory):
    game = await client.post("/api/admin/games", json={"name": "Smash Karts"})
    game_id = game.json()["data"]["id"]

    created = await client.post(
        "/api/admin/tournaments",
        json={
            "game_id": game_id,
            "name": "Cup",
            "entry_fee": "0",
            "prize_pool": "1000.00",
            "max_players": 8,
            "start_time": _future(48),
            "registration_deadline": _future(24),
        },
    )
    tournament_id = created.json()["data"]["id"]

    player_one = await user_factory(email="p1@example.com")
    player_two = await user_factory(email="p2@example.com")

    for player, uid in ((player_one, "UID-1"), (player_two, "UID-2")):
        account = await GameAccount(user_id=player.id, game_id=game_id, game_uid=uid).insert()
        await Registration(
            user_id=player.id,
            tournament_id=tournament_id,
            game_account_id=account.id,
            game_uid=uid,
            registration_status=RegistrationStatus.CONFIRMED,
            payment_status=RegistrationPaymentStatus.CAPTURED,
            reserved_until=datetime.now(timezone.utc) + timedelta(hours=1),
        ).insert()

    return tournament_id, player_one, player_two


async def _create_match_and_enter_results(client, tournament_id, player_one, player_two):
    match = await client.post(
        f"/api/admin/tournaments/{tournament_id}/matches",
        json={
            "match_number": 1,
            "scheduled_time": _future(1),
            "join_window_opens_at": _future(1),
            "join_window_closes_at": _future(2),
        },
    )
    assert match.status_code == 201
    match_id = match.json()["data"]["id"]

    rule = await client.post(
        f"/api/admin/tournaments/{tournament_id}/scoring-rule",
        json={"method": "PLACEMENT_ONLY", "placement_points": {"1": 10, "2": 5}},
    )
    assert rule.status_code == 201

    result_one = await client.post(
        f"/api/admin/matches/{match_id}/results/manual", json={"game_uid": "UID-1", "placement": 1}
    )
    assert result_one.status_code == 201
    result_two = await client.post(
        f"/api/admin/matches/{match_id}/results/manual", json={"game_uid": "UID-2", "placement": 2}
    )
    assert result_two.status_code == 201

    return match_id, result_one.json()["data"]["id"], result_two.json()["data"]["id"]


async def _publish_results(client, tournament_id):
    # Matches/results were entered against a DRAFT tournament (create_match has no status
    # precondition) -- walk the lifecycle forward from there to RESULTS_PUBLISHED.
    for action in ("open-registration", "close-registration", "mark-ready", "start", "end"):
        response = await client.post(f"/api/admin/tournaments/{tournament_id}/{action}")
        assert response.status_code == 200, response.text

    reviewed = await client.post(f"/api/admin/tournaments/{tournament_id}/review-results")
    assert reviewed.status_code == 200

    published = await client.post(f"/api/admin/tournaments/{tournament_id}/publish-results")
    assert published.status_code == 200
    return published.json()["data"]


async def test_enter_results_computes_ranks(client, as_admin, user_factory):
    tournament_id, player_one, player_two = await _setup_tournament_with_two_confirmed_players(
        client, as_admin, user_factory
    )
    match_id, _, _ = await _create_match_and_enter_results(client, tournament_id, player_one, player_two)

    results = await client.get(f"/api/admin/matches/{match_id}/results")
    assert results.status_code == 200
    assert len(results.json()["data"]) == 2

    published = await _publish_results(client, tournament_id)
    by_user = {r["user_id"]: r for r in published}
    assert by_user[str(player_one.id)]["rank"] == 1
    assert by_user[str(player_two.id)]["rank"] == 2


async def test_correction_without_paid_prize_not_flagged(client, as_admin, user_factory):
    tournament_id, player_one, player_two = await _setup_tournament_with_two_confirmed_players(
        client, as_admin, user_factory
    )
    match_id, result_one_id, _ = await _create_match_and_enter_results(client, tournament_id, player_one, player_two)
    await _publish_results(client, tournament_id)

    correction = await client.post(
        f"/api/admin/results/{result_one_id}/correction",
        json={"placement": 2, "reason": "Placement was misreported by the spotter."},
    )
    assert correction.status_code == 200
    revision = correction.json()["data"]["revision"]
    assert revision["financial_impact_flagged"] is False


async def test_correction_after_paid_prize_is_flagged(client, as_admin, user_factory):
    """Regression test for the fix in result_service.correct_result: a correction to a result
    that already has a PAID prize behind it must flag financial_impact_flagged so an admin
    reviews the payout -- previously this was hardcoded to False and never actually checked."""
    tournament_id, player_one, player_two = await _setup_tournament_with_two_confirmed_players(
        client, as_admin, user_factory
    )
    match_id, result_one_id, _ = await _create_match_and_enter_results(client, tournament_id, player_one, player_two)
    await _publish_results(client, tournament_id)

    prize = await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes",
        json={"user_id": str(player_one.id), "rank": 1, "amount": "700.00"},
    )
    assert prize.status_code == 201
    prize_id = prize.json()["data"]["id"]

    paid = await client.post(f"/api/admin/prizes/{prize_id}/mark-paid")
    assert paid.status_code == 200
    assert paid.json()["data"]["payout_status"] == "PAID"

    correction = await client.post(
        f"/api/admin/results/{result_one_id}/correction",
        json={"placement": 3, "reason": "Video review shows a different final placement."},
    )
    assert correction.status_code == 200
    revision = correction.json()["data"]["revision"]
    assert revision["financial_impact_flagged"] is True
