from datetime import datetime

from beanie import PydanticObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession

from app.models.refund import Refund, RefundStatus


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


async def mark_processed_if_pending(
    refund_id: PydanticObjectId,
    *,
    provider_reference: str | None,
    processed_by: PydanticObjectId,
    processed_at: datetime,
    session: AsyncClientSession | None = None,
) -> Refund | None:
    """Atomically flips (PENDING|FAILED) -> PROCESSED in a single findOneAndUpdate guarded by
    the current status, mirroring prize_repository.mark_paid_if_pending /
    registration_repository.reserve_slot. Prevents two concurrent "process refund" calls for
    the same refund from both succeeding and double-crediting the ledger."""
    collection = Refund.get_pymongo_collection()
    result = await collection.find_one_and_update(
        {"_id": refund_id, "status": {"$ne": RefundStatus.PROCESSED.value}},
        {
            "$set": {
                "status": RefundStatus.PROCESSED.value,
                "provider_reference": provider_reference,
                "processed_by": processed_by,
                "processed_at": processed_at,
            }
        },
        return_document=ReturnDocument.AFTER,
        session=session,
    )
    if result is None:
        return None
    return await Refund.get(refund_id, session=session)
