from typing import Any

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class AuditLog(BaseDocument):
    actor_id: PydanticObjectId | None
    action: str  # "<METHOD> <path>", e.g. "POST /api/admin/tournaments/{id}/cancel"
    entity: str  # best-effort resource name parsed from the path, e.g. "tournaments"
    status_code: int
    # The request payload IS the "before/after" metadata for most admin actions here (e.g.
    # correction/cancel endpoints already carry explicit old/new or a reason in their body).
    request_body: dict[str, Any] | None = None

    class Settings:
        name = "audit_logs"
        indexes = [
            IndexModel([("actor_id", ASCENDING)], name="ix_audit_logs_actor_id"),
            IndexModel([("entity", ASCENDING)], name="ix_audit_logs_entity"),
            IndexModel([("created_at", ASCENDING)], name="ix_audit_logs_created_at"),
        ]
