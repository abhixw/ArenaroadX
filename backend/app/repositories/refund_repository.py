from beanie import PydanticObjectId

from app.models.refund import Refund


async def get_by_id(refund_id: PydanticObjectId) -> Refund | None:
    return await Refund.get(refund_id)


async def list_by_tournament(tournament_id: PydanticObjectId) -> list[Refund]:
    return await Refund.find(Refund.tournament_id == tournament_id).to_list()


async def create(**fields) -> Refund:
    refund = Refund(**fields)
    await refund.insert()
    return refund


async def update(refund: Refund, **fields) -> Refund:
    for key, value in fields.items():
        setattr(refund, key, value)
    await refund.save()
    return refund
