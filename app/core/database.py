from beanie import Document, init_beanie
from pymongo import AsyncMongoClient

from app.core.config import settings

# tz_aware=True: without it, PyMongo returns naive datetimes for BSON dates (they're always
# UTC internally, but naive-by-default breaks comparisons against datetime.now(timezone.utc)
# everywhere in this codebase).
client: AsyncMongoClient = AsyncMongoClient(settings.MONGODB_URL, tz_aware=True)


def get_database():
    return client[settings.MONGODB_DB_NAME]


async def init_db(document_models: list[type[Document]]) -> None:
    await init_beanie(database=get_database(), document_models=document_models)
