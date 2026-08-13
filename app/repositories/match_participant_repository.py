from beanie import PydanticObjectId

from app.models.match_participant import MatchParticipant


async def get_by_match_and_user(match_id: PydanticObjectId, user_id: PydanticObjectId) -> MatchParticipant | None:
    return await MatchParticipant.find_one(MatchParticipant.match_id == match_id, MatchParticipant.user_id == user_id)


async def list_by_match(match_id: PydanticObjectId) -> list[MatchParticipant]:
    return await MatchParticipant.find(MatchParticipant.match_id == match_id).to_list()


async def bulk_create(participants: list[MatchParticipant]) -> None:
    if participants:
        await MatchParticipant.insert_many(participants)
