from beanie import PydanticObjectId
from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_admin
from app.models.user import User
from app.repositories import transaction_repository
from app.schemas.common import DataResponse, ListResponse
from app.schemas.refund import ProcessRefundRequest, RefundResponse
from app.schemas.transaction import TransactionResponse
from app.services import refund_service

admin_tournament_router = APIRouter(
    prefix="/api/admin/tournaments", tags=["admin:refunds"], dependencies=[Depends(require_admin)]
)
admin_refunds_router = APIRouter(prefix="/api/admin/refunds", tags=["admin:refunds"], dependencies=[Depends(require_admin)])


@admin_tournament_router.get(
    "/{tournament_id}/refunds",
    response_model=ListResponse[RefundResponse],
    summary="List refunds for a tournament (admin only)",
)
async def list_tournament_refunds(tournament_id: PydanticObjectId) -> ListResponse[RefundResponse]:
    refunds = await refund_service.list_tournament_refunds(tournament_id)
    return ListResponse(data=[refund_service.to_response(r) for r in refunds])


@admin_refunds_router.post(
    "/{refund_id}/process",
    response_model=DataResponse[RefundResponse],
    summary="Mark a refund processed with the payment provider's reference (admin only; manual, no automated transfer)",
)
async def process_refund(
    refund_id: PydanticObjectId, payload: ProcessRefundRequest, current_user: User = Depends(get_current_user)
) -> DataResponse[RefundResponse]:
    refund = await refund_service.process_refund(refund_id, payload, current_user.id)
    return DataResponse(data=refund_service.to_response(refund))


@admin_tournament_router.get(
    "/{tournament_id}/ledger",
    response_model=ListResponse[TransactionResponse],
    summary="View the append-only financial ledger for a tournament (admin only)",
)
async def get_tournament_ledger(tournament_id: PydanticObjectId) -> ListResponse[TransactionResponse]:
    transactions = await transaction_repository.list_by_tournament(tournament_id)
    return ListResponse(
        data=[
            TransactionResponse(
                id=t.id,
                tournament_id=t.tournament_id,
                user_id=t.user_id,
                type=t.type,
                amount=(t.amount_paise / 100),
                reference_id=t.reference_id,
                note=t.note,
                created_at=t.created_at,
            )
            for t in transactions
        ]
    )
