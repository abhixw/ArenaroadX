from datetime import datetime

from beanie import PydanticObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession

from app.models.prize import Prize, PrizePayoutStatus


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


async def mark_paid_if_pending(
    prize_id: PydanticObjectId, *, paid_at: datetime, session: AsyncClientSession | None = None
) -> Prize | None:
    """Atomically flips PENDING -> PAID in a single findOneAndUpdate guarded by the current
    status, mirroring registration_repository.reserve_slot. Two concurrent "mark paid" calls
    for the same prize can never both succeed: the second finds no document matching the
    `$ne PAID` filter (the first already flipped it) and gets None back here, instead of both
    racing past a separate read-then-write check and double-paying the ledger."""
    collection = Prize.get_pymongo_collection()
    result = await collection.find_one_and_update(
        {"_id": prize_id, "payout_status": {"$ne": PrizePayoutStatus.PAID.value}},
        {"$set": {"payout_status": PrizePayoutStatus.PAID.value, "paid_at": paid_at}},
        return_document=ReturnDocument.AFTER,
        session=session,
    )
    if result is None:
        return None
    return await Prize.get(prize_id, session=session)
