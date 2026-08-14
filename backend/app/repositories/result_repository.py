from sqlalchemy import select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.result import Result, ResultStatus


async def get_by_id(db: AsyncSession, result_id: int) -> Result | None:
    return await db.get(Result, result_id)


async def get_by_tournament_and_user(db: AsyncSession, tournament_id: int, user_id: int) -> Result | None:
    stmt = select(Result).where(Result.tournament_id == tournament_id, Result.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_by_tournament(db: AsyncSession, tournament_id: int, *, status: ResultStatus | None = None) -> list[Result]:
    stmt = select(Result).where(Result.tournament_id == tournament_id)
    if status is not None:
        stmt = stmt.where(Result.status == status)
    stmt = stmt.order_by(Result.rank)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **fields) -> Result:
    result = Result(**fields)
    db.add(result)
    await db.flush()
    await db.refresh(result)
    return result


async def update(db: AsyncSession, result: Result, **fields) -> Result:
    for key, value in fields.items():
        setattr(result, key, value)
    await db.flush()
    await db.refresh(result)
    return result


async def list_published_by_tournament_with_user(db: AsyncSession, tournament_id: int) -> list[Result]:
    stmt = (
        select(Result)
        .where(Result.tournament_id == tournament_id, Result.status == ResultStatus.PUBLISHED)
        .options(selectinload(Result.user))
        .order_by(Result.rank)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_published_by_user_with_tournament(db: AsyncSession, user_id: int) -> list[Result]:
    stmt = (
        select(Result)
        .where(Result.user_id == user_id, Result.status == ResultStatus.PUBLISHED)
        .options(selectinload(Result.tournament))
        .order_by(Result.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def publish_all_for_tournament(db: AsyncSession, tournament_id: int) -> None:
    stmt = (
        sa_update(Result)
        .where(Result.tournament_id == tournament_id, Result.status == ResultStatus.DRAFT)
        .values(status=ResultStatus.PUBLISHED)
    )
    await db.execute(stmt)
    await db.flush()
