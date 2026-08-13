from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, status

from app.core.dependencies import require_admin, require_user
from app.models.user import User
from app.schemas.common import DataResponse, ListResponse
from app.schemas.registration import (
    DisqualifyRequest,
    MyTournamentResponse,
    ParticipantResponse,
    PlayerHistoryResponse,
    RegistrationResponse,
)
from app.schemas.user import UserResponse
from app.services import registration_service, tournament_service
from app.repositories import user_repository

router = APIRouter(prefix="/api/tournaments", tags=["registrations"])
my_tournaments_router = APIRouter(prefix="/api/my-tournaments", tags=["registrations"])
admin_tournament_router = APIRouter(
    prefix="/api/admin/tournaments", tags=["admin:participants"], dependencies=[Depends(require_admin)]
)
admin_registrations_router = APIRouter(
    prefix="/api/admin/registrations", tags=["admin:participants"], dependencies=[Depends(require_admin)]
)
admin_players_router = APIRouter(
    prefix="/api/admin/players", tags=["admin:participants"], dependencies=[Depends(require_admin)]
)


@router.post(
    "/{tournament_id}/register",
    response_model=DataResponse[RegistrationResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register for a tournament (creates a PENDING_PAYMENT registration with a temporary slot hold)",
)
async def register_for_tournament(
    tournament_id: PydanticObjectId, current_user: User = Depends(require_user)
) -> DataResponse[RegistrationResponse]:
    registration = await registration_service.register_for_tournament(
        user_id=current_user.id, tournament_id=tournament_id
    )
    return DataResponse(data=RegistrationResponse.model_validate(registration, from_attributes=True))


async def _to_my_tournament_response(registration) -> MyTournamentResponse:
    tournament = await tournament_service.get_tournament(registration.tournament_id)
    return MyTournamentResponse(
        registration_id=registration.id,
        registration_status=registration.registration_status,
        payment_status=registration.payment_status,
        reserved_until=registration.reserved_until,
        registered_at=registration.created_at,
        tournament=tournament_service.to_response(tournament),
    )


@my_tournaments_router.get(
    "", response_model=ListResponse[MyTournamentResponse], summary="List tournaments the current user registered for"
)
async def list_my_tournaments(current_user: User = Depends(require_user)) -> ListResponse[MyTournamentResponse]:
    registrations = await registration_service.list_my_tournaments(current_user.id)
    return ListResponse(data=[await _to_my_tournament_response(r) for r in registrations])


@my_tournaments_router.get(
    "/{tournament_id}",
    response_model=DataResponse[MyTournamentResponse],
    summary="Get the current user's (latest) registration for a specific tournament",
)
async def get_my_tournament(
    tournament_id: PydanticObjectId, current_user: User = Depends(require_user)
) -> DataResponse[MyTournamentResponse]:
    registration = await registration_service.get_my_tournament(user_id=current_user.id, tournament_id=tournament_id)
    return DataResponse(data=await _to_my_tournament_response(registration))


@admin_tournament_router.get(
    "/{tournament_id}/participants",
    response_model=ListResponse[ParticipantResponse],
    summary="List confirmed participants for a tournament (admin only)",
)
async def list_tournament_participants(tournament_id: PydanticObjectId) -> ListResponse[ParticipantResponse]:
    registrations = await registration_service.list_tournament_participants(tournament_id)
    entries = []
    for r in registrations:
        user = await user_repository.get_by_id(r.user_id)
        entries.append(
            ParticipantResponse(
                user_id=r.user_id,
                name=user.name if user else "",
                email=user.email if user else "",
                game_uid=r.game_uid,
                payment_status=r.payment_status,
                registration_status=r.registration_status,
            )
        )
    return ListResponse(data=entries)


@admin_registrations_router.post(
    "/{registration_id}/disqualify",
    response_model=DataResponse[RegistrationResponse],
    summary="Disqualify a participant with a mandatory reason (admin only); disqualified users cannot receive prizes",
)
async def disqualify_registration(
    registration_id: PydanticObjectId, payload: DisqualifyRequest
) -> DataResponse[RegistrationResponse]:
    registration = await registration_service.disqualify_registration(registration_id, payload.reason)
    return DataResponse(data=RegistrationResponse.model_validate(registration, from_attributes=True))


@admin_players_router.get(
    "/{user_id}",
    response_model=DataResponse[PlayerHistoryResponse],
    summary="Get a player's full tournament registration history (admin only)",
)
async def get_player_history(user_id: PydanticObjectId) -> DataResponse[PlayerHistoryResponse]:
    user, registrations = await registration_service.get_player_history(user_id)
    return DataResponse(
        data=PlayerHistoryResponse(
            user=UserResponse.model_validate(user, from_attributes=True),
            registrations=[await _to_my_tournament_response(r) for r in registrations],
        )
    )
