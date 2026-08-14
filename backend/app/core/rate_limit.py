"""In-memory rate limiting for sensitive endpoints (login, register, payment creation,
result imports, admin auth). No Redis in this MVP by design, so this is a single-process,
fixed-window limiter -- resets on restart and doesn't share state across instances. That's
an accepted MVP limitation; a multi-instance deployment would need a shared store instead.
"""

import time
from collections import defaultdict

from fastapi import Request, status

from app.core.exceptions import AppError

_buckets: dict[str, list[float]] = defaultdict(list)


class RateLimitExceededError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    error_code = "RATE_LIMIT_EXCEEDED"

    def __init__(self, message: str = "Too many requests. Please try again shortly.") -> None:
        super().__init__(message)


def rate_limit(bucket: str, limit: int, window_seconds: int):
    """Returns a FastAPI dependency enforcing `limit` requests per `window_seconds`,
    keyed by (bucket, client IP)."""

    async def _dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"{bucket}:{client_ip}"
        now = time.monotonic()
        window_start = now - window_seconds

        timestamps = _buckets[key]
        while timestamps and timestamps[0] < window_start:
            timestamps.pop(0)

        if len(timestamps) >= limit:
            raise RateLimitExceededError()

        timestamps.append(now)

    return _dependency
