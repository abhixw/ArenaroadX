from beanie import PydanticObjectId

from app.models.transaction import Transaction


async def create(**fields) -> Transaction:
    transaction = Transaction(**fields)
    await transaction.insert()
    return transaction


async def list_by_tournament(tournament_id: PydanticObjectId) -> list[Transaction]:
    return await Transaction.find(Transaction.tournament_id == tournament_id).sort(-Transaction.created_at).to_list()
