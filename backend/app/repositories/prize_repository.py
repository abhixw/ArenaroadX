from beanie import PydanticObjectId
from pymongo.asynchronous.client_session import AsyncClientSession

from app.models.prize import Prize


async def get_by_id(prize_id: PydanticObjectId) -> Prize | None:
    return await Prize.get(prize_id)


async def list_by_tournament(tournament_id: PydanticObjectId) -> list[Prize]:
    return await Prize.find(Prize.tournament_id == tournament_id).sort(+Prize.rank).to_list()


async def list_by_user(user_id: PydanticObjectId) -> list[Prize]:
    return await Prize.find(Prize.user_id == user_id).sort(-Prize.created_at).to_list()


async def get_by_tournament_and_user(tournament_id: PydanticObjectId, user_id: PydanticObjectId) -> Prize | None:
    return await Prize.find_one(Prize.tournament_id == tournament_id, Prize.user_id == user_id)


async def create(*, session: AsyncClientSession | None = None, **fields) -> Prize:
    prize = Prize(**fields)
    await prize.insert(session=session)
    return prize


async def update(prize: Prize, *, session: AsyncClientSession | None = None, **fields) -> Prize:
    for key, value in fields.items():
        setattr(prize, key, value)
    await prize.save(session=session)
    return prize
