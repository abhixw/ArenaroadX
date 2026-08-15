from datetime import datetime, timedelta, timezone

import pytest

from app.models.game_account import GameAccount
from app.models.payment import Payment, PaymentStatus
from app.models.registration import Registration, RegistrationPaymentStatus, RegistrationStatus
from app.repositories import refund_repository

pytestmark = pytest.mark.asyncio


def _future(hours: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


async def _create_game(client) -> str:
    response = await client.post("/api/admin/games", json={"name": "Smash Karts"})
    assert response.status_code == 201
    return response.json()["data"]["id"]


async def _confirmed_paid_registration(client, game_id: str, user, entry_fee_paise: int = 5000):
    """Sets up a CONFIRMED registration with a CAPTURED payment behind it, the state a real
    player reaches only via the Razorpay verify flow -- built directly here since these tests
    aren't about payment verification itself."""
    tournament = await client.post(
        "/api/admin/tournaments",
        json={
            "game_id": game_id,
            "name": "Cup",
            "entry_fee": str(entry_fee_paise / 100),
            "prize_pool": "1000.00",
            "max_players": 8,
            "start_time": _future(48),
            "registration_deadline": _future(24),
        },
    )
    tournament_id = tournament.json()["data"]["id"]

    account = await GameAccount(user_id=user.id, game_id=game_id, game_uid="UID-1").insert()
    registration = await Registration(
        user_id=user.id,
        tournament_id=tournament_id,
        game_account_id=account.id,
        game_uid="UID-1",
        registration_status=RegistrationStatus.CONFIRMED,
        payment_status=RegistrationPaymentStatus.CAPTURED,
        reserved_until=datetime.now(timezone.utc) + timedelta(hours=1),
    ).insert()

    payment = await Payment(
        user_id=user.id,
        tournament_id=registration.tournament_id,
        registration_id=registration.id,
        amount_paise=entry_fee_paise,
        razorpay_order_id=f"order_{registration.id}",
        razorpay_payment_id=f"pay_{registration.id}",
        status=PaymentStatus.CAPTURED,
    ).insert()
    registration.payment_id = payment.id
    await registration.save()

    return tournament_id, registration


async def test_cancelling_tournament_twice_does_not_duplicate_refunds(client, as_admin, user_factory):
    """Regression test: re-cancelling an already-CANCELLED tournament (e.g. a double-click or
    retried request) used to create a second PENDING refund for the same registration, since
    create_refunds_for_cancelled_tournament had no idempotency check."""
    game_id = await _create_game(client)
    player = await user_factory(email="player@example.com")
    tournament_id, registration = await _confirmed_paid_registration(client, game_id, player)

    first_cancel = await client.post(
        f"/api/admin/tournaments/{tournament_id}/cancel", json={"reason": "Not enough players"}
    )
    assert first_cancel.status_code == 200

    second_cancel = await client.post(
        f"/api/admin/tournaments/{tournament_id}/cancel", json={"reason": "Not enough players"}
    )
    assert second_cancel.status_code == 200

    refunds = await refund_repository.list_by_tournament(registration.tournament_id)
    matching = [r for r in refunds if r.registration_id == registration.id]
    assert len(matching) == 1


async def test_mark_prize_paid_twice_is_rejected(client, as_admin, user_factory):
    """Regression test: mark_prize_paid had no already-PAID guard (unlike process_refund),
    so a repeated request would double-post a PRIZE ledger entry for the same payout."""
    game_id = await _create_game(client)
    player = await user_factory(email="player2@example.com")
    tournament_id, registration = await _confirmed_paid_registration(client, game_id, player)

    # Prize allocation requires RESULTS_PUBLISHED/COMPLETED.
    from app.models.tournament import Tournament, TournamentStatus

    tournament = await Tournament.get(tournament_id)
    tournament.status = TournamentStatus.RESULTS_PUBLISHED
    await tournament.save()

    prize = await client.post(
        f"/api/admin/tournaments/{tournament_id}/prizes",
        json={"user_id": str(registration.user_id), "rank": 1, "amount": "700.00"},
    )
    assert prize.status_code == 201
    prize_id = prize.json()["data"]["id"]

    first_pay = await client.post(f"/api/admin/prizes/{prize_id}/mark-paid")
    assert first_pay.status_code == 200
    assert first_pay.json()["data"]["payout_status"] == "PAID"

    second_pay = await client.post(f"/api/admin/prizes/{prize_id}/mark-paid")
    assert second_pay.status_code == 409
    assert second_pay.json()["error"]["code"] == "PRIZE_ALREADY_PAID"


async def test_expired_reservation_sweep_releases_slot(client, as_admin, user_factory):
    """Regression test for registration_service._sweep_expired_reservations: the slot release
    and the registration's EXPIRED transition are now atomic (wrapped in a Mongo transaction)
    -- this exercises the sweep end-to-end via a real registration attempt."""
    from app.models.tournament import Tournament

    game_id = await _create_game(client)
    tournament = await client.post(
        "/api/admin/tournaments",
        json={
            "game_id": game_id,
            "name": "One Slot Cup",
            "entry_fee": "0",
            "prize_pool": "0",
            "max_players": 1,
            "start_time": _future(48),
            "registration_deadline": _future(24),
        },
    )
    tournament_id = tournament.json()["data"]["id"]
    await client.post(f"/api/admin/tournaments/{tournament_id}/open-registration")

    stale_user = await user_factory(email="stale@example.com")
    stale_account = await GameAccount(user_id=stale_user.id, game_id=game_id, game_uid="STALE-UID").insert()
    await Registration(
        user_id=stale_user.id,
        tournament_id=tournament_id,
        game_account_id=stale_account.id,
        game_uid="STALE-UID",
        registration_status=RegistrationStatus.PENDING_PAYMENT,
        payment_status=RegistrationPaymentStatus.PENDING,
        # Already expired -- the next registration attempt's sweep should pick this up.
        reserved_until=datetime.now(timezone.utc) - timedelta(minutes=5),
    ).insert()
    tournament_doc = await Tournament.get(tournament_id)
    tournament_doc.reserved_slots = 1
    await tournament_doc.save()

    new_user = await user_factory(email="newplayer@example.com")
    from tests.conftest import login_as

    await login_as(client, new_user)
    await GameAccount(user_id=new_user.id, game_id=game_id, game_uid="NEW-UID").insert()

    register = await client.post(f"/api/tournaments/{tournament_id}/register")
    assert register.status_code == 201, register.text

    tournament_after = await Tournament.get(tournament_id)
    assert tournament_after.reserved_slots == 1
