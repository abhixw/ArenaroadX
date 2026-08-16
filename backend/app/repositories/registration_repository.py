from datetime import datetime, timezone

from beanie import PydanticObjectId
from beanie.operators import In
from pymongo import ReturnDocument
from pymongo.asynchronous.client_session import AsyncClientSession

from app.models.registration import ACTIVE_REGISTRATION_STATUSES, Registration, RegistrationStatus
from app.models.tournament import Tournament


async def reserve_slot(tournament_id: PydanticObjectId, *, session: AsyncClientSession | None = None) -> bool:
    """Atomically increments reserved_slots only if there's room, in a single
    findOneAndUpdate. MongoDB has no SELECT ... FOR UPDATE; this $expr-guarded
    conditional update is the equivalent -- it's atomic per-document, so two
    concurrent callers can never both succeed past max_players."""
    collection = Tournament.get_pymongo_collection()
    result = await collection.find_one_and_update(
        {"_id": tournament_id, "$expr": {"$lt": ["$reserved_slots", "$max_players"]}},
        {"$inc": {"reserved_slots": 1}},
        return_document=ReturnDocument.AFTER,
        session=session,
    )
    return result is not None


async def release_slot(tournament_id: PydanticObjectId, *, session: AsyncClientSession | None = None) -> None:
    collection = Tournament.get_pymongo_collection()
    await collection.find_one_and_update(
        {"_id": tournament_id, "reserved_slots": {"$gt": 0}},
        {"$inc": {"reserved_slots": -1}},
        session=session,
    )


async def get_by_id(registration_id: PydanticObjectId) -> Registration | None:
    return await Registration.get(registration_id)


async def get_active_by_user_and_tournament(
    user_id: PydanticObjectId, tournament_id: PydanticObjectId
) -> Registration | None:
    return await Registration.find_one(
        Registration.user_id == user_id,
        Registration.tournament_id == tournament_id,
        In(Registration.registration_status, list(ACTIVE_REGISTRATION_STATUSES)),
    )


async def get_latest_by_user_and_tournament(
    user_id: PydanticObjectId, tournament_id: PydanticObjectId
) -> Registration | None:
    results = (
        await Registration.find(Registration.user_id == user_id, Registration.tournament_id == tournament_id)
        .sort(-Registration.created_at)
        .limit(1)
        .to_list()
    )
    return results[0] if results else None


async def list_by_user(user_id: PydanticObjectId) -> list[Registration]:
    return await Registration.find(Registration.user_id == user_id).sort(-Registration.created_at).to_list()


async def list_expired_pending(tournament_id: PydanticObjectId) -> list[Registration]:
    now = datetime.now(timezone.utc)
    return await Registration.find(
        Registration.tournament_id == tournament_id,
        Registration.registration_status == RegistrationStatus.PENDING_PAYMENT,
        Registration.reserved_until < now,
    ).to_list()


async def list_confirmed_by_tournament(tournament_id: PydanticObjectId) -> list[Registration]:
    return await Registration.find(
        Registration.tournament_id == tournament_id,
        Registration.registration_status == RegistrationStatus.CONFIRMED,
    ).to_list()


async def create(*, session: AsyncClientSession | None = None, **fields) -> Registration:
    registration = Registration(**fields)
    await registration.insert(session=session)
    return registration


async def update(registration: Registration, *, session: AsyncClientSession | None = None, **fields) -> Registration:
    for key, value in fields.items():
        setattr(registration, key, value)
    await registration.save(session=session)
    return registration
