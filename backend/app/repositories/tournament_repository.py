from datetime import datetime, timezone

from beanie import PydanticObjectId
from beanie.operators import NotIn

from app.models.tournament import Tournament, TournamentStatus


async def get_by_id(tournament_id: PydanticObjectId) -> Tournament | None:
    return await Tournament.get(tournament_id)


async def list_all(*, game_id: PydanticObjectId | None = None, status: TournamentStatus | None = None) -> list[Tournament]:
    query = {}
    if game_id is not None:
        query["game_id"] = game_id
    if status is not None:
        query["status"] = status
    return await Tournament.find(query).sort(+Tournament.start_time).to_list()


async def list_upcoming() -> list[Tournament]:
    now = datetime.now(timezone.utc)
    return (
        await Tournament.find(
            Tournament.start_time > now,
            NotIn(Tournament.status, [TournamentStatus.CANCELLED, TournamentStatus.COMPLETED]),
        )
        .sort(+Tournament.start_time)
        .to_list()
    )


async def create(**fields) -> Tournament:
    tournament = Tournament(**fields)
    await tournament.insert()
    return tournament


async def update(tournament: Tournament, **fields) -> Tournament:
    for key, value in fields.items():
        setattr(tournament, key, value)
    await tournament.save()
    return tournament
