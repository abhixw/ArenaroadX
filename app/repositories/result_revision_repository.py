from beanie import PydanticObjectId

from app.models.result_revision import ResultRevision


async def create(**fields) -> ResultRevision:
    revision = ResultRevision(**fields)
    await revision.insert()
    return revision


async def list_by_tournament_result(tournament_result_id: PydanticObjectId) -> list[ResultRevision]:
    return (
        await ResultRevision.find(ResultRevision.tournament_result_id == tournament_result_id)
        .sort(-ResultRevision.created_at)
        .to_list()
    )
