from beanie import PydanticObjectId

from app.models.match_result import MatchResult


async def get_by_id(match_result_id: PydanticObjectId) -> MatchResult | None:
    return await MatchResult.get(match_result_id)


async def get_by_match_and_user(match_id: PydanticObjectId, user_id: PydanticObjectId) -> MatchResult | None:
    return await MatchResult.find_one(MatchResult.match_id == match_id, MatchResult.user_id == user_id)


async def list_by_match(match_id: PydanticObjectId) -> list[MatchResult]:
    return await MatchResult.find(MatchResult.match_id == match_id).to_list()


async def list_by_tournament(tournament_id: PydanticObjectId) -> list[MatchResult]:
    return await MatchResult.find(MatchResult.tournament_id == tournament_id).to_list()


async def create(**fields) -> MatchResult:
    result = MatchResult(**fields)
    await result.insert()
    return result


async def update(result: MatchResult, **fields) -> MatchResult:
    for key, value in fields.items():
        setattr(result, key, value)
    await result.save()
    return result
