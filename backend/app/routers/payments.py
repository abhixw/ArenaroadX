import logging

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.core.dependencies import require_admin, require_user
from app.core.exceptions import UnauthorizedError
from app.core.rate_limit import rate_limit
from app.models.payment import Payment
from app.models.user import User, UserRole
from app.schemas.common import DataResponse, ListResponse, Pagination
from app.schemas.payment import (
    AdminPaymentResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    PaymentResponse,
    VerifyPaymentRequest,
)
from app.services import payment_service

logger = logging.getLogger("tournament_backend.webhooks")

router = APIRouter(prefix="/api/payments", tags=["payments"])
admin_router = APIRouter(prefix="/api/admin/payments", tags=["admin:payments"], dependencies=[Depends(require_admin)])
webhook_router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def _to_create_order_response(payment: Payment) -> CreateOrderResponse:
    return CreateOrderResponse(
        payment_id=payment.id,
        order_id=payment.razorpay_order_id,
        amount=payment.amount_paise,
        currency=payment.currency,
    )


@router.post(
    "/create-order",
    response_model=DataResponse[CreateOrderResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a Razorpay order for a pending registration",
    dependencies=[Depends(rate_limit("payment-create-order", limit=10, window_seconds=60))],
)
async def create_order(
    payload: CreateOrderRequest, current_user: User = Depends(require_user)
) -> DataResponse[CreateOrderResponse]:
    payment = await payment_service.create_order(user_id=current_user.id, tournament_id=payload.tournament_id)
    return DataResponse(data=_to_create_order_response(payment))


@router.post(
    "/verify",
    response_model=DataResponse[PaymentResponse],
    summary="Verify a Razorpay payment signature and confirm the registration",
    dependencies=[Depends(rate_limit("payment-verify", limit=10, window_seconds=60))],
)
async def verify_payment(
    payload: VerifyPaymentRequest, current_user: User = Depends(require_user)
) -> DataResponse[PaymentResponse]:
    payment = await payment_service.verify_payment(
        user_id=current_user.id,
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature,
    )
    return DataResponse(data=PaymentResponse.model_validate(payment, from_attributes=True))


@router.get("", response_model=ListResponse[PaymentResponse], summary="List the current user's payments")
async def list_my_payments(current_user: User = Depends(require_user)) -> ListResponse[PaymentResponse]:
    payments = await payment_service.list_my_payments(current_user.id)
    return ListResponse(data=[PaymentResponse.model_validate(p, from_attributes=True) for p in payments])


@admin_router.get(
    "", response_model=ListResponse[AdminPaymentResponse], summary="List every payment, optionally filtered to one tournament (admin only)"
)
async def list_all_payments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    tournament_id: PydanticObjectId | None = Query(default=None),
) -> ListResponse[AdminPaymentResponse]:
    payments, total = await payment_service.list_all_payments(page=page, page_size=page_size, tournament_id=tournament_id)
    return ListResponse(data=payments, pagination=Pagination(page=page, page_size=page_size, total=total))


@router.get("/{payment_id}", response_model=DataResponse[PaymentResponse], summary="Get a payment by id")
async def get_payment(
    payment_id: PydanticObjectId, current_user: User = Depends(require_user)
) -> DataResponse[PaymentResponse]:
    payment = await payment_service.get_payment(
        payment_id=payment_id, user_id=current_user.id, is_admin=current_user.role == UserRole.ADMIN
    )
    return DataResponse(data=PaymentResponse.model_validate(payment, from_attributes=True))


@webhook_router.post("/razorpay", summary="Razorpay webhook receiver (called by Razorpay, not end users)")
async def razorpay_webhook(request: Request) -> Response:
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    try:
        raw_body_text = raw_body.decode("utf-8")
    except UnicodeDecodeError:
        raise UnauthorizedError("Invalid webhook signature.")

    if not signature or not payment_service.verify_webhook_signature(raw_body_text, signature):
        raise UnauthorizedError("Invalid webhook signature.")

    payload = await request.json()
    event_type = payload.get("event", "")

    try:
        await payment_service.handle_webhook_event(event_type, payload)
    except Exception:
        logger.exception("Error processing Razorpay webhook event=%s", event_type)
        # Still acknowledge: we don't want Razorpay to retry-storm on our internal errors
        # once the signature has already been verified as authentic.

    return Response(status_code=status.HTTP_200_OK)
