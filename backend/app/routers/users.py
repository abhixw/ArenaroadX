from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_admin
from app.schemas.common import DataResponse, ListResponse, Pagination
from app.schemas.user import AdminResetPasswordRequest, UpdateUserStatusRequest, UserResponse
from app.services import user_service

admin_router = APIRouter(prefix="/api/admin/users", tags=["admin:users"], dependencies=[Depends(require_admin)])


@admin_router.get("", response_model=ListResponse[UserResponse], summary="List/search users (admin only)")
async def list_users(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ListResponse[UserResponse]:
    users, total = await user_service.list_users(search=search, page=page, page_size=page_size)
    return ListResponse(
        data=[UserResponse.model_validate(u, from_attributes=True) for u in users],
        pagination=Pagination(page=page, page_size=page_size, total=total),
    )


@admin_router.put(
    "/{user_id}/status",
    response_model=DataResponse[UserResponse],
    summary="Suspend, ban, or reactivate a user (admin only)",
)
async def update_user_status(user_id: PydanticObjectId, payload: UpdateUserStatusRequest) -> DataResponse[UserResponse]:
    user = await user_service.update_status(user_id, payload.status)
    return DataResponse(data=UserResponse.model_validate(user, from_attributes=True))


@admin_router.post(
    "/{user_id}/reset-password",
    response_model=DataResponse[UserResponse],
    summary="Set a new password for a user (admin only)",
)
async def reset_password(user_id: PydanticObjectId, payload: AdminResetPasswordRequest) -> DataResponse[UserResponse]:
    user = await user_service.reset_password(user_id, payload.new_password)
    return DataResponse(data=UserResponse.model_validate(user, from_attributes=True))
