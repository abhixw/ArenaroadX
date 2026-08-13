from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, status

from app.core.dependencies import require_admin, require_user
from app.models.user import User
from app.schemas.common import DataResponse, ListResponse
from app.schemas.prize import MyPrizeResponse, PrizeCreate, PrizeResponse, PrizeUpdate
from app.services import prize_service

router = APIRouter(prefix="/api/tournaments", tags=["prizes"])
users_router = APIRouter(prefix="/api/users", tags=["prizes"])
admin_tournament_router = APIRouter(
    prefix="/api/admin/tournaments", tags=["admin:prizes"], dependencies=[Depends(require_admin)]
)
admin_prizes_router = APIRouter(prefix="/api/admin/prizes", tags=["admin:prizes"], dependencies=[Depends(require_admin)])


@users_router.get(
    "/me/prizes",
    response_model=ListResponse[MyPrizeResponse],
    summary="List the current user's prizes across all tournaments",
)
async def list_my_prizes(current_user: User = Depends(require_user)) -> ListResponse[MyPrizeResponse]:
    entries = await prize_service.list_my_prizes(current_user.id)
    return ListResponse(data=entries)


@router.get(
    "/{tournament_id}/prizes",
    response_model=ListResponse[PrizeResponse],
    summary="List prizes for a tournament",
    dependencies=[Depends(require_user)],
)
async def list_prizes(tournament_id: PydanticObjectId) -> ListResponse[PrizeResponse]:
    prizes = await prize_service.list_tournament_prizes(tournament_id)
    return ListResponse(data=[prize_service.to_response(p) for p in prizes])


@admin_tournament_router.post(
    "/{tournament_id}/prizes",
    response_model=DataResponse[PrizeResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a prize (admin only; only once results are published)",
)
async def create_prize(tournament_id: PydanticObjectId, payload: PrizeCreate) -> DataResponse[PrizeResponse]:
    prize = await prize_service.create_prize(tournament_id, payload)
    return DataResponse(data=prize_service.to_response(prize))


@admin_prizes_router.put("/{prize_id}", response_model=DataResponse[PrizeResponse], summary="Update a prize (admin only)")
async def update_prize(prize_id: PydanticObjectId, payload: PrizeUpdate) -> DataResponse[PrizeResponse]:
    prize = await prize_service.update_prize(prize_id, payload)
    return DataResponse(data=prize_service.to_response(prize))


@admin_prizes_router.post(
    "/{prize_id}/mark-paid",
    response_model=DataResponse[PrizeResponse],
    summary="Mark a prize as paid (admin only, manual payout tracking -- no automated transfer)",
)
async def mark_prize_paid(prize_id: PydanticObjectId) -> DataResponse[PrizeResponse]:
    prize = await prize_service.mark_prize_paid(prize_id)
    return DataResponse(data=prize_service.to_response(prize))
