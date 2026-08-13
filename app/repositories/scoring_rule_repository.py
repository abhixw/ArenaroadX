from beanie import PydanticObjectId

from app.models.scoring_rule import ScoringRule


async def get_active_for_tournament(tournament_id: PydanticObjectId) -> ScoringRule | None:
    return await ScoringRule.find_one(ScoringRule.tournament_id == tournament_id, ScoringRule.is_active == True)  # noqa: E712


async def get_latest_version(tournament_id: PydanticObjectId) -> ScoringRule | None:
    results = (
        await ScoringRule.find(ScoringRule.tournament_id == tournament_id)
        .sort(-ScoringRule.version)
        .limit(1)
        .to_list()
    )
    return results[0] if results else None


async def create_new_version(tournament_id: PydanticObjectId, **fields) -> ScoringRule:
    previous = await get_active_for_tournament(tournament_id)
    if previous is not None:
        previous.is_active = False
        await previous.save()

    latest = await get_latest_version(tournament_id)
    next_version = (latest.version + 1) if latest else 1

    rule = ScoringRule(tournament_id=tournament_id, version=next_version, is_active=True, **fields)
    await rule.insert()
    return rule
