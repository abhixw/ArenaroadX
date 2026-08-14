from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import require_admin
from app.models.tournament import TournamentStatus
from app.schemas.common import DataResponse, ListResponse
from app.schemas.tournament import CancelTournamentRequest, TournamentCreate, TournamentResponse, TournamentUpdate
from app.services import refund_service, tournament_service

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])
admin_router = APIRouter(
    prefix="/api/admin/tournaments", tags=["admin:tournaments"], dependencies=[Depends(require_admin)]
)


@router.get("", response_model=ListResponse[TournamentResponse], summary="List tournaments, optionally filtered")
async def list_tournaments(
    game_id: PydanticObjectId | None = Query(default=None),
    status_: TournamentStatus | None = Query(default=None, alias="status"),
) -> ListResponse[TournamentResponse]:
    tournaments = await tournament_service.list_tournaments(game_id=game_id, status=status_)
    return ListResponse(data=[tournament_service.to_response(t) for t in tournaments])


@router.get("/{tournament_id}", response_model=DataResponse[TournamentResponse], summary="Get a tournament by id")
async def get_tournament(tournament_id: PydanticObjectId) -> DataResponse[TournamentResponse]:
    tournament = await tournament_service.get_tournament(tournament_id)
    return DataResponse(data=tournament_service.to_response(tournament))


@admin_router.post(
    "",
    response_model=DataResponse[TournamentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a tournament (admin only, starts in DRAFT status)",
)
async def create_tournament(payload: TournamentCreate) -> DataResponse[TournamentResponse]:
    tournament = await tournament_service.create_tournament(payload)
    return DataResponse(data=tournament_service.to_response(tournament))


@admin_router.put(
    "/{tournament_id}", response_model=DataResponse[TournamentResponse], summary="Update a tournament (admin only)"
)
async def update_tournament(
    tournament_id: PydanticObjectId, payload: TournamentUpdate
) -> DataResponse[TournamentResponse]:
    tournament = await tournament_service.update_tournament(tournament_id, payload)
    return DataResponse(data=tournament_service.to_response(tournament))


@admin_router.post(
    "/{tournament_id}/open-registration",
    response_model=DataResponse[TournamentResponse],
    summary="Open registration (DRAFT -> REGISTRATION_OPEN)",
)
async def open_registration(tournament_id: PydanticObjectId) -> DataResponse[TournamentResponse]:
    tournament = await tournament_service.open_registration(tournament_id)
    return DataResponse(data=tournament_service.to_response(tournament))


@admin_router.post(
    "/{tournament_id}/close-registration",
    response_model=DataResponse[TournamentResponse],
    summary="Close registration (REGISTRATION_OPEN -> REGISTRATION_CLOSED)",
)
async def close_registration(tournament_id: PydanticObjectId) -> DataResponse[TournamentResponse]:
    tournament = await tournament_service.close_registration(tournament_id)
    return DataResponse(data=tournament_service.to_response(tournament))


@admin_router.post(
    "/{tournament_id}/mark-ready",
    response_model=DataResponse[TournamentResponse],
    summary="Mark the tournament ready (REGISTRATION_CLOSED -> READY)",
)
async def mark_ready(tournament_id: PydanticObjectId) -> DataResponse[TournamentResponse]:
    tournament = await tournament_service.mark_ready(tournament_id)
    return DataResponse(data=tournament_service.to_response(tournament))


@admin_router.post(
    "/{tournament_id}/start",
    response_model=DataResponse[TournamentResponse],
    summary="Start the tournament (READY -> LIVE)",
)
async def start_tournament(tournament_id: PydanticObjectId) -> DataResponse[TournamentResponse]:
    tournament = await tournament_service.start_tournament(tournament_id)
    return DataResponse(data=tournament_service.to_response(tournament))


@admin_router.post(
    "/{tournament_id}/end",
    response_model=DataResponse[TournamentResponse],
    summary="End the tournament (LIVE -> RESULTS_PENDING)",
)
async def end_tournament(tournament_id: PydanticObjectId) -> DataResponse[TournamentResponse]:
    tournament = await tournament_service.end_tournament(tournament_id)
    return DataResponse(data=tournament_service.to_response(tournament))


@admin_router.post(
    "/{tournament_id}/cancel",
    response_model=DataResponse[TournamentResponse],
    summary="Cancel the tournament with a required reason; confirmed paid registrations enter the refund workflow",
)
async def cancel_tournament(
    tournament_id: PydanticObjectId, payload: CancelTournamentRequest
) -> DataResponse[TournamentResponse]:
    tournament = await tournament_service.cancel_tournament(tournament_id, payload.reason)
    await refund_service.create_refunds_for_cancelled_tournament(tournament_id, payload.reason)
    return DataResponse(data=tournament_service.to_response(tournament))
