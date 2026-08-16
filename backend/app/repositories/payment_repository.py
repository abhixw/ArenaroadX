from beanie import PydanticObjectId
from beanie.operators import In
from pymongo import ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession

from app.models.payment import Payment, PaymentStatus


async def get_by_id(payment_id: PydanticObjectId, *, session: AsyncClientSession | None = None) -> Payment | None:
    return await Payment.get(payment_id, session=session)


async def get_by_order_id(razorpay_order_id: str) -> Payment | None:
    return await Payment.find_one(Payment.razorpay_order_id == razorpay_order_id)


async def get_pending_by_registration(registration_id: PydanticObjectId) -> Payment | None:
    return await Payment.find_one(
        Payment.registration_id == registration_id,
        In(Payment.status, [PaymentStatus.CREATED, PaymentStatus.PENDING]),
    )


async def list_by_user(user_id: PydanticObjectId) -> list[Payment]:
    return await Payment.find(Payment.user_id == user_id).sort(-Payment.created_at).to_list()


async def list_all(*, page: int = 1, page_size: int = 20) -> tuple[list[Payment], int]:
    query = Payment.find_all()
    total = await query.count()
    items = await query.sort(-Payment.created_at).skip((page - 1) * page_size).limit(page_size).to_list()
    return items, total


async def create(*, session: AsyncClientSession | None = None, **fields) -> Payment:
    payment = Payment(**fields)
    await payment.insert(session=session)
    return payment


async def update(payment: Payment, *, session: AsyncClientSession | None = None, **fields) -> Payment:
    for key, value in fields.items():
        setattr(payment, key, value)
    await payment.save(session=session)
    return payment


async def mark_captured_if_not_already(
    payment_id: PydanticObjectId,
    *,
    razorpay_payment_id: str,
    razorpay_signature: str | None = None,
    session: AsyncClientSession | None = None,
) -> Payment | None:
    """Atomically flips (CREATED|PENDING|FAILED) -> CAPTURED in a single findOneAndUpdate
    guarded by the current status, mirroring prize_repository.mark_paid_if_pending /
    refund_repository.mark_processed_if_pending. A client-side /verify call and a Razorpay
    webhook delivery for the same payment can race; without this guard, both could pass a
    separate read-then-write check and both confirm the registration / write an ENTRY_FEE
    ledger entry."""
    updates: dict = {"status": PaymentStatus.CAPTURED.value, "razorpay_payment_id": razorpay_payment_id}
    if razorpay_signature is not None:
        updates["razorpay_signature"] = razorpay_signature

    collection = Payment.get_pymongo_collection()
    result = await collection.find_one_and_update(
        {"_id": payment_id, "status": {"$ne": PaymentStatus.CAPTURED.value}},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
        session=session,
    )
    if result is None:
        return None
    return await Payment.get(payment_id, session=session)
