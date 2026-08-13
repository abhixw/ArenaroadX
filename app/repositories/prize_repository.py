from beanie import PydanticObjectId

from app.models.prize import Prize


async def get_by_id(prize_id: PydanticObjectId) -> Prize | None:
    return await Prize.get(prize_id)


async def list_by_tournament(tournament_id: PydanticObjectId) -> list[Prize]:
    return await Prize.find(Prize.tournament_id == tournament_id).sort(+Prize.rank).to_list()


async def create(**fields) -> Prize:
    prize = Prize(**fields)
    await prize.insert()
    return prize


async def update(prize: Prize, **fields) -> Prize:
    for key, value in fields.items():
        setattr(prize, key, value)
    await prize.save()
    return prize
