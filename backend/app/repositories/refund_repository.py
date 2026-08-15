from beanie import PydanticObjectId
from pymongo.asynchronous.client_session import AsyncClientSession

from app.models.refund import Refund


async def get_by_id(refund_id: PydanticObjectId) -> Refund | None:
    return await Refund.get(refund_id)


async def list_by_tournament(tournament_id: PydanticObjectId) -> list[Refund]:
    return await Refund.find(Refund.tournament_id == tournament_id).to_list()


async def registration_ids_with_refund(tournament_id: PydanticObjectId) -> set[PydanticObjectId]:
    refunds = await Refund.find(Refund.tournament_id == tournament_id).to_list()
    return {refund.registration_id for refund in refunds}


async def create(*, session: AsyncClientSession | None = None, **fields) -> Refund:
    refund = Refund(**fields)
    await refund.insert(session=session)
    return refund


async def update(refund: Refund, *, session: AsyncClientSession | None = None, **fields) -> Refund:
    for key, value in fields.items():
        setattr(refund, key, value)
    await refund.save(session=session)
    return refund
