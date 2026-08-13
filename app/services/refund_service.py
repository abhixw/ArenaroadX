from datetime import datetime, timezone
from decimal import Decimal

from beanie import PydanticObjectId

from app.core.exceptions import RefundAlreadyProcessedError, RefundNotFoundError, TournamentNotFoundError
from app.models.payment import PaymentStatus
from app.models.refund import Refund, RefundStatus
from app.models.registration import RegistrationPaymentStatus, RegistrationStatus
from app.models.transaction import TransactionType
from app.repositories import (
    payment_repository,
    refund_repository,
    registration_repository,
    tournament_repository,
    transaction_repository,
)
from app.schemas.refund import ProcessRefundRequest, RefundResponse

_PAISE_PER_RUPEE = 100


def _to_rupees(paise: int) -> Decimal:
    return Decimal(paise) / _PAISE_PER_RUPEE


def to_response(refund: Refund) -> RefundResponse:
    return RefundResponse(
        id=refund.id,
        payment_id=refund.payment_id,
        registration_id=refund.registration_id,
        tournament_id=refund.tournament_id,
        user_id=refund.user_id,
        amount=_to_rupees(refund.amount_paise),
        reason=refund.reason,
        provider_reference=refund.provider_reference,
        status=refund.status,
        processed_by=refund.processed_by,
        processed_at=refund.processed_at,
        created_at=refund.created_at,
    )


async def create_refunds_for_cancelled_tournament(tournament_id: PydanticObjectId, reason: str) -> list[Refund]:
    """Confirmed, paid registrations are identified for refund handling when a tournament
    is cancelled (spec section 16). Refunds start PENDING -- actually moving the money is
    a manual admin step (process_refund), consistent with this MVP's no-automated-payouts rule."""
    confirmed = await registration_repository.list_confirmed_by_tournament(tournament_id)

    created: list[Refund] = []
    for registration in confirmed:
        if registration.payment_status != RegistrationPaymentStatus.CAPTURED or registration.payment_id is None:
            continue
        payment = await payment_repository.get_by_id(registration.payment_id)
        if payment is None or payment.status != PaymentStatus.CAPTURED:
            continue

        refund = await refund_repository.create(
            payment_id=payment.id,
            registration_id=registration.id,
            tournament_id=tournament_id,
            user_id=registration.user_id,
            amount_paise=payment.amount_paise,
            reason=reason,
            status=RefundStatus.PENDING,
        )
        created.append(refund)
    return created


async def list_tournament_refunds(tournament_id: PydanticObjectId) -> list[Refund]:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    return await refund_repository.list_by_tournament(tournament_id)


async def process_refund(refund_id: PydanticObjectId, payload: ProcessRefundRequest, processed_by: PydanticObjectId) -> Refund:
    refund = await refund_repository.get_by_id(refund_id)
    if refund is None:
        raise RefundNotFoundError()
    if refund.status == RefundStatus.PROCESSED:
        raise RefundAlreadyProcessedError()

    refund = await refund_repository.update(
        refund,
        status=RefundStatus.PROCESSED,
        provider_reference=payload.provider_reference,
        processed_by=processed_by,
        processed_at=datetime.now(timezone.utc),
    )

    payment = await payment_repository.get_by_id(refund.payment_id)
    if payment is not None:
        await payment_repository.update(payment, status=PaymentStatus.REFUNDED)

    registration = await registration_repository.get_by_id(refund.registration_id)
    if registration is not None:
        await registration_repository.update(
            registration, registration_status=RegistrationStatus.CANCELLED, payment_status=RegistrationPaymentStatus.REFUNDED
        )

    await transaction_repository.create(
        tournament_id=refund.tournament_id,
        user_id=refund.user_id,
        type=TransactionType.REFUND,
        amount_paise=-refund.amount_paise,
        reference_id=refund.id,
        note=f"Refund processed, provider_reference={payload.provider_reference}.",
    )
    return refund
