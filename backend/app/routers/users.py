from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_admin
from app.schemas.common import DataResponse, ListResponse
from app.schemas.user import UpdateUserStatusRequest, UserResponse
from app.services import user_service

admin_router = APIRouter(prefix="/api/admin/users", tags=["admin:users"], dependencies=[Depends(require_admin)])


@admin_router.get("", response_model=ListResponse[UserResponse], summary="List/search users (admin only)")
async def list_users(search: str | None = Query(default=None)) -> ListResponse[UserResponse]:
    users = await user_service.list_users(search=search)
    return ListResponse(data=[UserResponse.model_validate(u, from_attributes=True) for u in users])


@admin_router.put(
    "/{user_id}/status",
    response_model=DataResponse[UserResponse],
    summary="Suspend, ban, or reactivate a user (admin only)",
)
async def update_user_status(user_id: PydanticObjectId, payload: UpdateUserStatusRequest) -> DataResponse[UserResponse]:
    user = await user_service.update_status(user_id, payload.status)
    return DataResponse(data=UserResponse.model_validate(user, from_attributes=True))
