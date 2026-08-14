from beanie import PydanticObjectId

from app.models.match import Match


async def get_by_id(match_id: PydanticObjectId) -> Match | None:
    return await Match.get(match_id)


async def get_by_tournament_and_number(tournament_id: PydanticObjectId, match_number: int) -> Match | None:
    return await Match.find_one(Match.tournament_id == tournament_id, Match.match_number == match_number)


async def list_by_tournament(tournament_id: PydanticObjectId) -> list[Match]:
    return await Match.find(Match.tournament_id == tournament_id).sort(+Match.match_number).to_list()


async def create(**fields) -> Match:
    match = Match(**fields)
    await match.insert()
    return match


async def update(match: Match, **fields) -> Match:
    for key, value in fields.items():
        setattr(match, key, value)
    await match.save()
    return match
