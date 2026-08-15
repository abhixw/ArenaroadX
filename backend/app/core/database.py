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


def session_client(document_model: type[Document]) -> AsyncMongoClient:
    """The Mongo client actually backing `document_model` right now -- not necessarily the
    module-level `client` above, since the test suite binds Beanie to its own separate
    client via a fresh init_beanie() call. PyMongo's AsyncMongoClient refuses to open a
    transaction session on a document if the session came from a different client instance
    than the one that owns its collection, so any code that needs `client.start_session()`
    for a multi-document transaction must resolve the client through the model it's about
    to write, via this helper, rather than importing `client` directly."""
    return document_model.get_pymongo_collection().database.client
