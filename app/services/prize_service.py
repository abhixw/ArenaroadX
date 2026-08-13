from datetime import datetime, timezone
from decimal import Decimal

from beanie import PydanticObjectId

from app.core.exceptions import PrizeNotFoundError, ResultsNotPublishedError, TournamentNotFoundError, UserNotFoundError
from app.models.prize import Prize, PrizePayoutStatus
from app.models.tournament import TournamentStatus
from app.models.transaction import TransactionType
from app.repositories import prize_repository, tournament_repository, transaction_repository, user_repository
from app.schemas.prize import MyPrizeResponse, PrizeCreate, PrizeResponse, PrizeUpdate

_PAISE_PER_RUPEE = 100


def _to_paise(rupees: Decimal) -> int:
    return int(rupees * _PAISE_PER_RUPEE)


def _to_rupees(paise: int) -> Decimal:
    return Decimal(paise) / _PAISE_PER_RUPEE


def to_response(prize: Prize) -> PrizeResponse:
    return PrizeResponse(
        id=prize.id,
        tournament_id=prize.tournament_id,
        user_id=prize.user_id,
        rank=prize.rank,
        amount=_to_rupees(prize.amount_paise),
        payout_status=prize.payout_status,
        paid_at=prize.paid_at,
        created_at=prize.created_at,
        updated_at=prize.updated_at,
    )


async def list_tournament_prizes(tournament_id: PydanticObjectId) -> list[Prize]:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    return await prize_repository.list_by_tournament(tournament_id)


async def list_my_prizes(user_id: PydanticObjectId) -> list[MyPrizeResponse]:
    prizes = await prize_repository.list_by_user(user_id)
    entries = []
    for p in prizes:
        tournament = await tournament_repository.get_by_id(p.tournament_id)
        entries.append(
            MyPrizeResponse(
                id=p.id,
                tournament_id=p.tournament_id,
                tournament_name=tournament.name if tournament else "",
                rank=p.rank,
                amount=_to_rupees(p.amount_paise),
                payout_status=p.payout_status,
                paid_at=p.paid_at,
                created_at=p.created_at,
            )
        )
    return entries


async def create_prize(tournament_id: PydanticObjectId, payload: PrizeCreate) -> Prize:
    tournament = await tournament_repository.get_by_id(tournament_id)
    if tournament is None:
        raise TournamentNotFoundError()
    # Spec section 15: "Prize allocation must not occur before results are published."
    if tournament.status not in (TournamentStatus.RESULTS_PUBLISHED, TournamentStatus.COMPLETED):
        raise ResultsNotPublishedError()

    user = await user_repository.get_by_id(payload.user_id)
    if user is None:
        raise UserNotFoundError()

    return await prize_repository.create(
        tournament_id=tournament_id,
        user_id=payload.user_id,
        rank=payload.rank,
        amount_paise=_to_paise(payload.amount),
        payout_status=PrizePayoutStatus.PENDING,
    )


async def update_prize(prize_id: PydanticObjectId, payload: PrizeUpdate) -> Prize:
    prize = await prize_repository.get_by_id(prize_id)
    if prize is None:
        raise PrizeNotFoundError()

    updates = payload.model_dump(exclude_unset=True)
    if "user_id" in updates:
        user = await user_repository.get_by_id(updates["user_id"])
        if user is None:
            raise UserNotFoundError()
    if "amount" in updates:
        updates["amount_paise"] = _to_paise(updates.pop("amount"))

    return await prize_repository.update(prize, **updates)


async def mark_prize_paid(prize_id: PydanticObjectId) -> Prize:
    prize = await prize_repository.get_by_id(prize_id)
    if prize is None:
        raise PrizeNotFoundError()

    prize = await prize_repository.update(
        prize, payout_status=PrizePayoutStatus.PAID, paid_at=datetime.now(timezone.utc)
    )

    # Every prize payment is recorded in the financial ledger (spec section 15).
    await transaction_repository.create(
        tournament_id=prize.tournament_id,
        user_id=prize.user_id,
        type=TransactionType.PRIZE,
        amount_paise=-prize.amount_paise,
        reference_id=prize.id,
        note=f"Prize paid for rank {prize.rank}.",
    )
    return prize
