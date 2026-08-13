from beanie import PydanticObjectId

from app.models.result_import import ResultImport


async def get_by_id(import_id: PydanticObjectId) -> ResultImport | None:
    return await ResultImport.get(import_id)


async def create(**fields) -> ResultImport:
    result_import = ResultImport(**fields)
    await result_import.insert()
    return result_import


async def update(result_import: ResultImport, **fields) -> ResultImport:
    for key, value in fields.items():
        setattr(result_import, key, value)
    await result_import.save()
    return result_import
