import razorpay
from beanie import PydanticObjectId

from app.core.config import settings
from app.core.database import session_client
from app.core.exceptions import (
    ForbiddenError,
    PaymentNotFoundError,
    PaymentVerificationError,
    RegistrationNotFoundError,
    RegistrationNotPendingPaymentError,
    TournamentNotFoundError,
)
from app.models.payment import Payment, PaymentStatus
from app.models.registration import RegistrationPaymentStatus, RegistrationStatus
from app.models.transaction import TransactionType
from app.repositories import (
    payment_repository,
    registration_repository,
    tournament_repository,
    transaction_repository,
    user_repository,
)
from app.schemas.payment import AdminPaymentResponse


def _client() -> razorpay.Client:
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


async def create_order(*, user_id: PydanticObjectId, tournament_id: PydanticObjectId) -> Payment:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()

    registration = await registration_repository.get_active_by_user_and_tournament(user_id, tournament_id)
    if registration is None:
        raise RegistrationNotFoundError()
    if registration.registration_status != RegistrationStatus.PENDING_PAYMENT:
        raise RegistrationNotPendingPaymentError()

    # Reuse an in-flight order instead of minting a new Razorpay order on every retry.
    existing_payment = await payment_repository.get_pending_by_registration(registration.id)
    if existing_payment is not None:
        return existing_payment

    order = _client().order.create(
        data={
            "amount": tournament.entry_fee_paise,
            "currency": "INR",
            "payment_capture": 1,
            "notes": {"tournament_id": str(tournament_id), "user_id": str(user_id)},
        }
    )

    return await payment_repository.create(
        user_id=user_id,
        tournament_id=tournament_id,
        registration_id=registration.id,
        amount_paise=tournament.entry_fee_paise,
        currency="INR",
        razorpay_order_id=order["id"],
        status=PaymentStatus.CREATED,
    )


async def _mark_captured(
    payment: Payment, *, razorpay_payment_id: str, razorpay_signature: str | None = None
) -> Payment:
    async def _capture(session) -> Payment:
        # Atomic guarded transition (see payment_repository.mark_captured_if_not_already) --
        # a client /verify call and a Razorpay webhook delivery for the same payment can
        # race, so this must not be a separate read-then-write check.
        captured = await payment_repository.mark_captured_if_not_already(
            payment.id,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature,
            session=session,
        )
        if captured is None:
            # Already captured by whichever of the two racing callers got there first --
            # idempotent no-op, not an error (both verify and the webhook expect success).
            # Must re-fetch: `payment` is this call's stale pre-capture snapshot, not
            # necessarily the state the other, winning caller just committed.
            return await payment_repository.get_by_id(payment.id, session=session)

        registration = await registration_repository.get_by_id(captured.registration_id)
        if registration is not None and registration.registration_status != RegistrationStatus.CONFIRMED:
            await registration_repository.update(
                registration,
                registration_status=RegistrationStatus.CONFIRMED,
                payment_status=RegistrationPaymentStatus.CAPTURED,
                payment_id=captured.id,
                session=session,
            )
            # Every entry fee payment is recorded in the financial ledger (spec section 18).
            await transaction_repository.create(
                tournament_id=captured.tournament_id,
                user_id=captured.user_id,
                type=TransactionType.ENTRY_FEE,
                amount_paise=captured.amount_paise,
                reference_id=captured.id,
                note="Entry fee captured.",
                session=session,
            )
        return captured

    async with session_client(Payment).start_session() as session:
        # with_transaction (not a bare start_transaction()) so a WriteConflict from two
        # truly concurrent captures of the same payment retries the callback instead of
        # surfacing a raw 500 -- see the matching comment in prize_service.mark_prize_paid.
        return await session.with_transaction(_capture)


async def _mark_failed_and_release_slot(payment: Payment) -> Payment:
    """Per spec: 'A payment failure ... releases the slot.' This is for Razorpay's
    authoritative payment.failed webhook event, not a client-side signature mismatch
    (which just means retry -- see verify_payment)."""

    async def _fail(session) -> Payment:
        updated = await payment_repository.update(payment, status=PaymentStatus.FAILED, session=session)

        registration = await registration_repository.get_by_id(updated.registration_id)
        if registration is not None and registration.registration_status == RegistrationStatus.PENDING_PAYMENT:
            await registration_repository.update(
                registration,
                registration_status=RegistrationStatus.CANCELLED,
                payment_status=RegistrationPaymentStatus.FAILED,
                session=session,
            )
            # release_slot is itself atomically guarded ($gt: 0), so this stays a safe no-op
            # even if with_transaction retries this callback.
            await registration_repository.release_slot(registration.tournament_id, session=session)
        return updated

    async with session_client(Payment).start_session() as session:
        return await session.with_transaction(_fail)


async def verify_payment(
    *,
    user_id: PydanticObjectId,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> Payment:
    payment = await payment_repository.get_by_order_id(razorpay_order_id)
    if payment is None:
        raise PaymentNotFoundError()
    if payment.user_id != user_id:
        raise ForbiddenError("This payment does not belong to you.")

    # Idempotent: a second verify call for an already-captured payment is a no-op success.
    if payment.status == PaymentStatus.CAPTURED:
        return payment

    tournament = await tournament_repository.get_by_id(payment.tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    if payment.amount_paise != tournament.entry_fee_paise:
        raise PaymentVerificationError("Payment amount does not match the tournament entry fee.")

    try:
        _client().utility.verify_payment_signature(
            {
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            }
        )
    except razorpay.errors.SignatureVerificationError:
        await payment_repository.update(payment, status=PaymentStatus.FAILED)
        raise PaymentVerificationError()

    return await _mark_captured(payment, razorpay_payment_id=razorpay_payment_id, razorpay_signature=razorpay_signature)


async def list_my_payments(user_id: PydanticObjectId) -> list[Payment]:
    return await payment_repository.list_by_user(user_id)


async def list_all_payments(*, page: int = 1, page_size: int = 20) -> tuple[list[AdminPaymentResponse], int]:
    payments, total = await payment_repository.list_all(page=page, page_size=page_size)

    user_ids = {p.user_id for p in payments}
    tournament_ids = {p.tournament_id for p in payments}
    users = {u.id: u for u in [await user_repository.get_by_id(uid) for uid in user_ids] if u is not None}
    tournaments = {
        t.id: t for t in [await tournament_repository.get_by_id(tid) for tid in tournament_ids] if t is not None
    }

    entries = []
    for p in payments:
        user = users.get(p.user_id)
        tournament = tournaments.get(p.tournament_id)
        entries.append(
            AdminPaymentResponse(
                id=p.id,
                user_id=p.user_id,
                player_name=user.name if user else "Unknown",
                player_email=user.email if user else "",
                tournament_id=p.tournament_id,
                tournament_name=tournament.name if tournament else "Unknown",
                amount_paise=p.amount_paise,
                currency=p.currency,
                razorpay_order_id=p.razorpay_order_id,
                razorpay_payment_id=p.razorpay_payment_id,
                status=p.status,
                created_at=p.created_at,
            )
        )
    return entries, total


async def get_payment(*, payment_id: PydanticObjectId, user_id: PydanticObjectId, is_admin: bool) -> Payment:
    payment = await payment_repository.get_by_id(payment_id)
    if payment is None:
        raise PaymentNotFoundError()
    if payment.user_id != user_id and not is_admin:
        raise ForbiddenError("This payment does not belong to you.")
    return payment


def verify_webhook_signature(raw_body: str, signature: str) -> bool:
    try:
        return bool(_client().utility.verify_webhook_signature(raw_body, signature, settings.RAZORPAY_WEBHOOK_SECRET))
    except razorpay.errors.SignatureVerificationError:
        return False


async def handle_webhook_event(event_type: str, payload: dict) -> None:
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

    if event_type == "payment.captured":
        order_id = payment_entity.get("order_id")
        razorpay_payment_id = payment_entity.get("id")
    elif event_type == "order.paid":
        order_entity = payload.get("payload", {}).get("order", {}).get("entity", {})
        order_id = order_entity.get("id")
        razorpay_payment_id = payment_entity.get("id")
    elif event_type == "payment.failed":
        order_id = payment_entity.get("order_id")
        payment = await payment_repository.get_by_order_id(order_id) if order_id else None
        if payment is not None and payment.status not in (PaymentStatus.CAPTURED, PaymentStatus.FAILED):
            await _mark_failed_and_release_slot(payment)
        return
    else:
        return  # event type not relevant to this MVP; acknowledge and ignore

    if not order_id or not razorpay_payment_id:
        return

    payment = await payment_repository.get_by_order_id(order_id)
    if payment is None:
        return  # unknown order; nothing for us to update

    if payment.status == PaymentStatus.CAPTURED:
        return  # idempotent: already processed (duplicate webhook delivery)

    await _mark_captured(payment, razorpay_payment_id=razorpay_payment_id)
