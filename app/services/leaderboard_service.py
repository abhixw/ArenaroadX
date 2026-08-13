from beanie import PydanticObjectId

from app.core.exceptions import TournamentNotFoundError
from app.models.tournament_result import TournamentResult
from app.repositories import tournament_repository, tournament_result_repository


async def get_tournament_leaderboard(tournament_id: PydanticObjectId) -> list[TournamentResult]:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    return await tournament_result_repository.list_published_by_tournament(tournament_id)


async def get_user_leaderboard_history(user_id: PydanticObjectId) -> list[TournamentResult]:
    return await tournament_result_repository.list_published_by_user(user_id)
