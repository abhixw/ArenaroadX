from beanie import PydanticObjectId

from app.models.tournament_result import TournamentResult, TournamentResultStatus


async def get_by_id(result_id: PydanticObjectId) -> TournamentResult | None:
    return await TournamentResult.get(result_id)


async def get_by_tournament_and_user(tournament_id: PydanticObjectId, user_id: PydanticObjectId) -> TournamentResult | None:
    return await TournamentResult.find_one(
        TournamentResult.tournament_id == tournament_id, TournamentResult.user_id == user_id
    )


async def list_by_tournament(tournament_id: PydanticObjectId) -> list[TournamentResult]:
    return await TournamentResult.find(TournamentResult.tournament_id == tournament_id).to_list()


async def list_published_by_tournament(tournament_id: PydanticObjectId) -> list[TournamentResult]:
    return (
        await TournamentResult.find(
            TournamentResult.tournament_id == tournament_id,
            TournamentResult.status == TournamentResultStatus.PUBLISHED,
        )
        .sort(+TournamentResult.rank)
        .to_list()
    )


async def list_published_by_user(user_id: PydanticObjectId) -> list[TournamentResult]:
    return await TournamentResult.find(
        TournamentResult.user_id == user_id, TournamentResult.status == TournamentResultStatus.PUBLISHED
    ).to_list()


async def upsert(*, tournament_id: PydanticObjectId, user_id: PydanticObjectId, **fields) -> TournamentResult:
    existing = await get_by_tournament_and_user(tournament_id, user_id)
    if existing is not None:
        for key, value in fields.items():
            setattr(existing, key, value)
        await existing.save()
        return existing

    result = TournamentResult(tournament_id=tournament_id, user_id=user_id, **fields)
    await result.insert()
    return result


async def bulk_update_status(
    tournament_id: PydanticObjectId, from_status: TournamentResultStatus, to_status: TournamentResultStatus
) -> None:
    results = await TournamentResult.find(
        TournamentResult.tournament_id == tournament_id, TournamentResult.status == from_status
    ).to_list()
    for r in results:
        r.status = to_status
        await r.save()


async def save_all(results: list[TournamentResult]) -> None:
    for r in results:
        await r.save()
