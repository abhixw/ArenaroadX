from beanie import PydanticObjectId

from app.core.exceptions import TournamentNotFoundError
from app.models.match_result import MatchResult
from app.models.tournament_result import TournamentResult
from app.repositories import match_result_repository, tournament_repository, tournament_result_repository, user_repository
from app.schemas.result import LeaderboardEntry


async def get_tournament_leaderboard(tournament_id: PydanticObjectId) -> list[TournamentResult]:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    return await tournament_result_repository.list_published_by_tournament(tournament_id)


async def get_user_leaderboard_history(user_id: PydanticObjectId) -> list[TournamentResult]:
    return await tournament_result_repository.list_published_by_user(user_id)


async def get_tournament_leaderboard_entries(tournament_id: PydanticObjectId) -> list[LeaderboardEntry]:
    results = await get_tournament_leaderboard(tournament_id)
    match_results = await match_result_repository.list_by_tournament(tournament_id)

    by_user: dict[PydanticObjectId, list[MatchResult]] = {}
    for mr in match_results:
        by_user.setdefault(mr.user_id, []).append(mr)

    entries: list[LeaderboardEntry] = []
    for r in results:
        user = await user_repository.get_by_id(r.user_id)
        single_match = by_user.get(r.user_id)
        game_uid = placement = kills = None
        if single_match and len(single_match) == 1:
            game_uid = single_match[0].game_uid
            placement = single_match[0].placement
            kills = single_match[0].kills
        entries.append(
            LeaderboardEntry(
                rank=r.rank or 0,
                user_id=r.user_id,
                player_name=user.name if user else "",
                score=r.total_score,
                game_uid=game_uid,
                placement=placement,
                kills=kills,
            )
        )
    return entries
