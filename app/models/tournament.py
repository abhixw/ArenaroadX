import enum
from datetime import datetime

from beanie import PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class TournamentStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    REGISTRATION_OPEN = "REGISTRATION_OPEN"
    REGISTRATION_CLOSED = "REGISTRATION_CLOSED"
    READY = "READY"
    LIVE = "LIVE"
    RESULTS_PENDING = "RESULTS_PENDING"
    RESULTS_REVIEW = "RESULTS_REVIEW"
    RESULTS_PUBLISHED = "RESULTS_PUBLISHED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Tournament(BaseDocument):
    game_id: PydanticObjectId
    name: str
    description: str | None = None
    # Money stored as integer paise (smallest INR unit) -- avoids float precision issues
    # and matches what's sent to Razorpay directly. Converted to rupees only at the API boundary.
    entry_fee_paise: int = Field(ge=0)
    prize_pool_paise: int = Field(ge=0)
    max_players: int = Field(gt=0)
    # Atomically incremented/decremented as registrations are created/released -- this is how
    # capacity is enforced without row-level locking (MongoDB has no SELECT ... FOR UPDATE);
    # see registration_repository.reserve_slot for the atomic conditional update.
    reserved_slots: int = Field(default=0, ge=0)
    start_time: datetime
    registration_deadline: datetime
    game_url: str | None = None
    rules: str | None = None
    instructions: str | None = None
    status: TournamentStatus = TournamentStatus.DRAFT
    cancellation_reason: str | None = None

    class Settings:
        name = "tournaments"
        indexes = [
            IndexModel([("game_id", ASCENDING)], name="ix_tournaments_game_id"),
            IndexModel([("status", ASCENDING)], name="ix_tournaments_status"),
            IndexModel([("start_time", ASCENDING)], name="ix_tournaments_start_time"),
        ]
