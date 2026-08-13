from beanie import PydanticObjectId
from beanie.operators import In

from app.models.payment import Payment, PaymentStatus


async def get_by_id(payment_id: PydanticObjectId) -> Payment | None:
    return await Payment.get(payment_id)


async def get_by_order_id(razorpay_order_id: str) -> Payment | None:
    return await Payment.find_one(Payment.razorpay_order_id == razorpay_order_id)


async def get_pending_by_registration(registration_id: PydanticObjectId) -> Payment | None:
    return await Payment.find_one(
        Payment.registration_id == registration_id,
        In(Payment.status, [PaymentStatus.CREATED, PaymentStatus.PENDING]),
    )


async def list_by_user(user_id: PydanticObjectId) -> list[Payment]:
    return await Payment.find(Payment.user_id == user_id).sort(-Payment.created_at).to_list()


async def list_all() -> list[Payment]:
    return await Payment.find_all().sort(-Payment.created_at).to_list()


async def create(**fields) -> Payment:
    payment = Payment(**fields)
    await payment.insert()
    return payment


async def update(payment: Payment, **fields) -> Payment:
    for key, value in fields.items():
        setattr(payment, key, value)
    await payment.save()
    return payment
