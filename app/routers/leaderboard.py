from beanie import PydanticObjectId
from fastapi import APIRouter, Depends

from app.core.dependencies import require_user
from app.models.user import User
from app.repositories import tournament_repository, user_repository
from app.schemas.common import DataResponse, ListResponse
from app.schemas.result import LeaderboardEntry, LeaderboardResponse, UserLeaderboardHistoryEntry
from app.services import leaderboard_service

router = APIRouter(prefix="/api/tournaments", tags=["leaderboard"])
users_router = APIRouter(prefix="/api/users", tags=["leaderboard"])


@router.get(
    "/{tournament_id}/leaderboard",
    response_model=DataResponse[LeaderboardResponse],
    summary="Get the leaderboard for a tournament (published results only)",
    dependencies=[Depends(require_user)],
)
async def get_tournament_leaderboard(tournament_id: PydanticObjectId) -> DataResponse[LeaderboardResponse]:
    results = await leaderboard_service.get_tournament_leaderboard(tournament_id)
    entries = []
    for r in results:
        user = await user_repository.get_by_id(r.user_id)
        entries.append(
            LeaderboardEntry(rank=r.rank or 0, user_id=r.user_id, player_name=user.name if user else "", score=r.total_score)
        )
    return DataResponse(data=LeaderboardResponse(tournament_id=tournament_id, entries=entries))


@users_router.get(
    "/me/leaderboard-history",
    response_model=ListResponse[UserLeaderboardHistoryEntry],
    summary="Get the current user's published results across all tournaments",
)
async def get_my_leaderboard_history(
    current_user: User = Depends(require_user),
) -> ListResponse[UserLeaderboardHistoryEntry]:
    results = await leaderboard_service.get_user_leaderboard_history(current_user.id)
    entries = []
    for r in results:
        tournament = await tournament_repository.get_by_id(r.tournament_id)
        entries.append(
            UserLeaderboardHistoryEntry(
                tournament_id=r.tournament_id,
                tournament_name=tournament.name if tournament else "",
                rank=r.rank or 0,
                score=r.total_score,
            )
        )
    return ListResponse(data=entries)
