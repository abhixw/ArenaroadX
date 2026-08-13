from datetime import datetime
from typing import Any

from beanie import PydanticObjectId
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: PydanticObjectId
    actor_id: PydanticObjectId | None
    action: str
    entity: str
    status_code: int
    request_body: dict[str, Any] | None
    created_at: datetime
