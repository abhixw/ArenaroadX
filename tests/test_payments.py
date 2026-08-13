from datetime import datetime, timedelta, timezone

import razorpay

from app.models.tournament import TournamentStatus
from app.repositories import game_repository, tournament_repository
from app.services import payment_service


class _FakeOrderResource:
    def __init__(self, order_id: str):
        self._order_id = order_id
        self.created_with: dict | None = None

    def create(self, data: dict) -> dict:
        self.created_with = data
        return {"id": self._order_id, "amount": data["amount"], "currency": data["currency"]}


class _FakeUtility:
    def __init__(self, should_succeed: bool):
        self.should_succeed = should_succeed

    def verify_payment_signature(self, parameters: dict) -> bool:
        if not self.should_succeed:
            raise razorpay.errors.SignatureVerificationError("Razorpay Signature Verification Failed")
        return True

    def verify_webhook_signature(self, body: str, signature: str, secret: str) -> bool:
        if not self.should_succeed:
            raise razorpay.errors.SignatureVerificationError("Razorpay Signature Verification Failed")
        return True


class FakeRazorpayClient:
    def __init__(self, order_id: str = "order_fake123", should_succeed: bool = True):
        self.order = _FakeOrderResource(order_id)
        self.utility = _FakeUtility(should_succeed)


def _patch_client(monkeypatch, fake_client: FakeRazorpayClient) -> None:
    monkeypatch.setattr(payment_service, "_client", lambda: fake_client)


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


async def _register_and_login_user(client, email: str = "player@example.com") -> None:
    await client.post(
        "/api/auth/register",
        json={"name": "Player", "email": email, "password": "StrongPassword123", "phone": "9876543210"},
    )
    await client.post("/api/auth/login", json={"email": email, "password": "StrongPassword123"})


async def _setup_pending_registration(client, db_session) -> int:
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    await _register_and_login_user(client)
    await client.post(f"/api/tournaments/{tournament_id}/register")
    return tournament_id


async def test_create_order_success(client, db_session, monkeypatch):
    tournament_id = await _setup_pending_registration(client, db_session)
    _patch_client(monkeypatch, FakeRazorpayClient(order_id="order_abc123"))

    resp = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["order_id"] == "order_abc123"
    assert body["amount"] == 5000  # entry_fee 50.00 -> paise
    assert body["currency"] == "INR"


async def test_create_order_without_registration_404(client, db_session, monkeypatch):
    game_id = await _make_game(db_session)
    tournament_id = await _make_tournament(db_session, game_id)
    await _register_and_login_user(client)
    _patch_client(monkeypatch, FakeRazorpayClient())

    resp = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "REGISTRATION_NOT_FOUND"


async def test_create_order_is_reused_on_retry(client, db_session, monkeypatch):
    tournament_id = await _setup_pending_registration(client, db_session)
    fake_client = FakeRazorpayClient(order_id="order_once")
    _patch_client(monkeypatch, fake_client)

    resp1 = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})
    resp2 = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})

    assert resp1.json()["data"]["payment_id"] == resp2.json()["data"]["payment_id"]
    assert resp1.json()["data"]["order_id"] == resp2.json()["data"]["order_id"]


async def test_verify_payment_valid_signature_confirms_registration(client, db_session, monkeypatch):
    tournament_id = await _setup_pending_registration(client, db_session)
    _patch_client(monkeypatch, FakeRazorpayClient(order_id="order_valid", should_succeed=True))

    create_resp = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})
    order_id = create_resp.json()["data"]["order_id"]

    verify_resp = await client.post(
        "/api/payments/verify",
        json={"razorpay_order_id": order_id, "razorpay_payment_id": "pay_valid", "razorpay_signature": "sig_valid"},
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["data"]["status"] == "CAPTURED"

    my_tournament_resp = await client.get(f"/api/my-tournaments/{tournament_id}")
    assert my_tournament_resp.json()["data"]["registration_status"] == "CONFIRMED"
    assert my_tournament_resp.json()["data"]["payment_status"] == "CAPTURED"


async def test_verify_payment_invalid_signature_rejected(client, db_session, monkeypatch):
    tournament_id = await _setup_pending_registration(client, db_session)
    _patch_client(monkeypatch, FakeRazorpayClient(order_id="order_invalid", should_succeed=False))

    create_resp = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})
    order_id = create_resp.json()["data"]["order_id"]

    verify_resp = await client.post(
        "/api/payments/verify",
        json={"razorpay_order_id": order_id, "razorpay_payment_id": "pay_bad", "razorpay_signature": "sig_bad"},
    )
    assert verify_resp.status_code == 400
    assert verify_resp.json()["error"]["code"] == "PAYMENT_VERIFICATION_FAILED"

    my_tournament_resp = await client.get(f"/api/my-tournaments/{tournament_id}")
    assert my_tournament_resp.json()["data"]["registration_status"] == "PENDING_PAYMENT"


async def test_verify_unknown_order_404(client, db_session, monkeypatch):
    await _register_and_login_user(client)
    _patch_client(monkeypatch, FakeRazorpayClient())

    resp = await client.post(
        "/api/payments/verify",
        json={"razorpay_order_id": "order_nope", "razorpay_payment_id": "pay_x", "razorpay_signature": "sig_x"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PAYMENT_NOT_FOUND"


async def test_verify_payment_duplicate_call_is_idempotent(client, db_session, monkeypatch):
    tournament_id = await _setup_pending_registration(client, db_session)
    _patch_client(monkeypatch, FakeRazorpayClient(order_id="order_dup", should_succeed=True))

    create_resp = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})
    order_id = create_resp.json()["data"]["order_id"]
    verify_payload = {
        "razorpay_order_id": order_id,
        "razorpay_payment_id": "pay_dup",
        "razorpay_signature": "sig_dup",
    }

    resp1 = await client.post("/api/payments/verify", json=verify_payload)
    resp2 = await client.post("/api/payments/verify", json=verify_payload)

    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert resp1.json()["data"]["id"] == resp2.json()["data"]["id"]
    assert resp2.json()["data"]["status"] == "CAPTURED"


async def test_get_payment_ownership_enforced(client, db_session, monkeypatch):
    tournament_id = await _setup_pending_registration(client, db_session)
    _patch_client(monkeypatch, FakeRazorpayClient(order_id="order_owner"))
    create_resp = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})
    payment_id = create_resp.json()["data"]["payment_id"]

    own_resp = await client.get(f"/api/payments/{payment_id}")
    assert own_resp.status_code == 200

    await client.post("/api/auth/logout")
    await _register_and_login_user(client, email="someoneelse@example.com")

    other_resp = await client.get(f"/api/payments/{payment_id}")
    assert other_resp.status_code == 403
    assert other_resp.json()["error"]["code"] == "FORBIDDEN"


async def test_webhook_payment_captured_confirms_registration(client, db_session, monkeypatch):
    tournament_id = await _setup_pending_registration(client, db_session)
    _patch_client(monkeypatch, FakeRazorpayClient(order_id="order_webhook", should_succeed=True))

    create_resp = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})
    order_id = create_resp.json()["data"]["order_id"]

    webhook_payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_webhook1", "order_id": order_id, "amount": 5000}}},
    }
    resp = await client.post(
        "/api/webhooks/razorpay", json=webhook_payload, headers={"X-Razorpay-Signature": "valid-sig"}
    )
    assert resp.status_code == 200

    my_tournament_resp = await client.get(f"/api/my-tournaments/{tournament_id}")
    assert my_tournament_resp.json()["data"]["registration_status"] == "CONFIRMED"


async def test_webhook_duplicate_delivery_is_idempotent(client, db_session, monkeypatch):
    tournament_id = await _setup_pending_registration(client, db_session)
    _patch_client(monkeypatch, FakeRazorpayClient(order_id="order_webhook_dup", should_succeed=True))

    create_resp = await client.post("/api/payments/create-order", json={"tournament_id": tournament_id})
    order_id = create_resp.json()["data"]["order_id"]

    webhook_payload = {
        "event": "payment.captured",
        "payload": {"payload": {}},
    }
    webhook_payload["payload"] = {"payment": {"entity": {"id": "pay_webhook_dup", "order_id": order_id}}}

    resp1 = await client.post(
        "/api/webhooks/razorpay", json=webhook_payload, headers={"X-Razorpay-Signature": "valid-sig"}
    )
    resp2 = await client.post(
        "/api/webhooks/razorpay", json=webhook_payload, headers={"X-Razorpay-Signature": "valid-sig"}
    )
    assert resp1.status_code == 200
    assert resp2.status_code == 200

    payment_resp = await client.get(f"/api/my-tournaments/{tournament_id}")
    assert payment_resp.json()["data"]["registration_status"] == "CONFIRMED"


async def test_webhook_invalid_signature_rejected(client, db_session, monkeypatch):
    _patch_client(monkeypatch, FakeRazorpayClient(should_succeed=False))

    resp = await client.post(
        "/api/webhooks/razorpay",
        json={"event": "payment.captured", "payload": {}},
        headers={"X-Razorpay-Signature": "bad-sig"},
    )
    assert resp.status_code == 401


async def test_webhook_missing_signature_rejected(client):
    resp = await client.post("/api/webhooks/razorpay", json={"event": "payment.captured", "payload": {}})
    assert resp.status_code == 401


async def test_webhook_unknown_order_acknowledged_without_error(client, db_session, monkeypatch):
    _patch_client(monkeypatch, FakeRazorpayClient(should_succeed=True))

    resp = await client.post(
        "/api/webhooks/razorpay",
        json={
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay_ghost", "order_id": "order_ghost"}}},
        },
        headers={"X-Razorpay-Signature": "valid-sig"},
    )
    assert resp.status_code == 200
