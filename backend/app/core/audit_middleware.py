import json
import logging

from beanie import PydanticObjectId
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.core.security import decode_access_token
from app.models.audit_log import AuditLog

logger = logging.getLogger("tournament_backend.audit")

_AUDITED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_SENSITIVE_KEYS = {"password", "razorpay_signature", "room_password"}


def _redact(body: dict) -> dict:
    return {k: ("<redacted>" if k in _SENSITIVE_KEYS else v) for k, v in body.items()}


def _entity_from_path(path: str) -> str:
    # "/api/admin/tournaments/507f.../cancel" -> "tournaments"
    parts = [p for p in path.split("/") if p]
    for i, part in enumerate(parts):
        if part == "admin" and i + 1 < len(parts):
            return parts[i + 1]
    return parts[-1] if parts else path


def _actor_id_from_request(request: Request) -> PydanticObjectId | None:
    token = request.cookies.get(settings.COOKIE_NAME)
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        return PydanticObjectId(payload.get("sub"))
    except Exception:
        return None


def _should_audit(request: Request) -> bool:
    if request.method not in _AUDITED_METHODS:
        return False
    path = request.url.path
    return path.startswith("/api/admin") or path in ("/api/payments/create-order", "/api/payments/verify")


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if not _should_audit(request):
            return await call_next(request)

        request_body = None
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                raw = await request.body()
                if raw:
                    request_body = _redact(json.loads(raw))
            except Exception:
                request_body = None
        # Multipart (file upload) bodies are intentionally not captured here -- reading
        # the stream would interfere with downstream multipart parsing.

        response = await call_next(request)

        try:
            await AuditLog(
                actor_id=_actor_id_from_request(request),
                action=f"{request.method} {request.url.path}",
                entity=_entity_from_path(request.url.path),
                status_code=response.status_code,
                request_body=request_body,
            ).insert()
        except Exception:
            logger.exception("Failed to write audit log entry for %s %s", request.method, request.url.path)

        return response
