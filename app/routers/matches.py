from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, status

from app.core.dependencies import require_admin, require_user
from app.models.user import User
from app.schemas.common import DataResponse, ListResponse
from app.schemas.match import MatchAccessResponse, MatchCreate, MatchResponse, MatchUpdate
from app.services import match_service

router = APIRouter(prefix="/api/tournaments", tags=["matches"])
admin_tournament_router = APIRouter(
    prefix="/api/admin/tournaments", tags=["admin:matches"], dependencies=[Depends(require_admin)]
)
admin_matches_router = APIRouter(
    prefix="/api/admin/matches", tags=["admin:matches"], dependencies=[Depends(require_admin)]
)


@router.get(
    "/{tournament_id}/matches",
    response_model=ListResponse[MatchResponse],
    summary="List matches for a tournament (no room credentials -- see /access)",
    dependencies=[Depends(require_user)],
)
async def list_matches(tournament_id: PydanticObjectId) -> ListResponse[MatchResponse]:
    matches = await match_service.list_matches(tournament_id)
    return ListResponse(data=[MatchResponse.model_validate(m, from_attributes=True) for m in matches])


@router.get(
    "/{tournament_id}/matches/{match_id}",
    response_model=DataResponse[MatchResponse],
    summary="Get match details (no room credentials -- see /access)",
    dependencies=[Depends(require_user)],
)
async def get_match(tournament_id: PydanticObjectId, match_id: PydanticObjectId) -> DataResponse[MatchResponse]:
    match = await match_service.get_match(match_id)
    return DataResponse(data=MatchResponse.model_validate(match, from_attributes=True))


@router.get(
    "/{tournament_id}/matches/{match_id}/access",
    response_model=DataResponse[MatchAccessResponse],
    summary="Get room/game access credentials (confirmed participants only, once the join window opens)",
)
async def get_match_access(
    tournament_id: PydanticObjectId, match_id: PydanticObjectId, current_user: User = Depends(require_user)
) -> DataResponse[MatchAccessResponse]:
    match = await match_service.get_match_access(match_id, current_user.id)
    return DataResponse(
        data=MatchAccessResponse(
            match_id=match.id, room_id=match.room_id, room_password=match.room_password, access_info=match.access_info
        )
    )


@admin_tournament_router.post(
    "/{tournament_id}/matches",
    response_model=DataResponse[MatchResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a match for a tournament (admin only; roster is auto-populated from confirmed registrations)",
)
async def create_match(tournament_id: PydanticObjectId, payload: MatchCreate) -> DataResponse[MatchResponse]:
    match = await match_service.create_match(tournament_id, payload)
    return DataResponse(data=MatchResponse.model_validate(match, from_attributes=True))


@admin_matches_router.put(
    "/{match_id}", response_model=DataResponse[MatchResponse], summary="Update a match (admin only)"
)
async def update_match(match_id: PydanticObjectId, payload: MatchUpdate) -> DataResponse[MatchResponse]:
    match = await match_service.update_match(match_id, payload)
    return DataResponse(data=MatchResponse.model_validate(match, from_attributes=True))


@admin_matches_router.post(
    "/{match_id}/start", response_model=DataResponse[MatchResponse], summary="Mark a match LIVE (admin only)"
)
async def start_match(match_id: PydanticObjectId) -> DataResponse[MatchResponse]:
    match = await match_service.start_match(match_id)
    return DataResponse(data=MatchResponse.model_validate(match, from_attributes=True))


@admin_matches_router.post(
    "/{match_id}/end", response_model=DataResponse[MatchResponse], summary="Mark a match COMPLETED (admin only)"
)
async def end_match(match_id: PydanticObjectId) -> DataResponse[MatchResponse]:
    match = await match_service.end_match(match_id)
    return DataResponse(data=MatchResponse.model_validate(match, from_attributes=True))


@admin_matches_router.post(
    "/{match_id}/cancel", response_model=DataResponse[MatchResponse], summary="Cancel a match (admin only)"
)
async def cancel_match(match_id: PydanticObjectId) -> DataResponse[MatchResponse]:
    match = await match_service.cancel_match(match_id)
    return DataResponse(data=MatchResponse.model_validate(match, from_attributes=True))
