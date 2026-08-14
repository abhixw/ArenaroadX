from datetime import datetime, timezone

from beanie import Document, Insert, Replace, Update, before_event
from pydantic import Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BaseDocument(Document):
    """Common timestamp behavior for all collections, mirroring the server_default/onupdate
    pattern used when this project was on SQLAlchemy."""

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)

    @before_event(Insert)
    def _set_created_at(self) -> None:
        now = _utcnow()
        self.created_at = now
        self.updated_at = now

    @before_event(Replace, Update)
    def _set_updated_at(self) -> None:
        self.updated_at = _utcnow()

    class Settings:
        use_state_management = True
