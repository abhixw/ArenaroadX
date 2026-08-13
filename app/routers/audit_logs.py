from fastapi import APIRouter, Depends

from app.core.dependencies import require_admin
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse
from app.schemas.common import ListResponse

router = APIRouter(prefix="/api/admin/audit-logs", tags=["admin:audit-logs"], dependencies=[Depends(require_admin)])


@router.get("", response_model=ListResponse[AuditLogResponse], summary="View the immutable admin activity log")
async def list_audit_logs(limit: int = 100) -> ListResponse[AuditLogResponse]:
    logs = await AuditLog.find_all().sort(-AuditLog.created_at).limit(min(limit, 500)).to_list()
    return ListResponse(data=[AuditLogResponse.model_validate(log, from_attributes=True) for log in logs])
