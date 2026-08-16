import asyncio
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


class GameIntegrationError(Exception):
    """Base class for all integration failures. Routers/services translate these into
    the app's normal AppError responses -- see app.core.exceptions.IntegrationLookupError."""


class PlayerNotFoundError(GameIntegrationError):
    """The provider has no account under this UID (e.g. Chess.com 404)."""


class IntegrationUnavailableError(GameIntegrationError):
    """The provider errored, rate-limited us past our retry budget, or timed out."""


@dataclass
class VerifiedProfile:
    """What every GameIntegration.verify_account() returns -- deliberately generic so the
    same GameAccount.provider_data/provider_player_id fields work for any future provider,
    not just Chess.com."""

    provider_player_id: str
    display_name: str | None
    avatar_url: str | None
    raw: dict[str, Any] = field(default_factory=dict)


class GameIntegration(ABC):
    """One implementation per external game provider (Chess.com today; e.g. a Lichess or
    Riot integration later would each be a sibling class here, registered in
    app.integrations.REGISTRY under their own key). Every method is read-only -- these call
    public, unauthenticated provider APIs and never mutate anything on the provider's side."""

    key: str

    @abstractmethod
    async def verify_account(self, uid: str) -> VerifiedProfile:
        """Raises PlayerNotFoundError if uid doesn't exist on the provider."""

    @abstractmethod
    async def get_stats(self, uid: str) -> dict[str, Any]:
        ...

    @abstractmethod
    async def list_archive_periods(self, uid: str) -> list[str]:
        """Returns opaque period identifiers (e.g. "2026/06") usable with get_games_for_period,
        newest-last as the provider returns them."""

    @abstractmethod
    async def get_games_for_period(self, uid: str, period: str) -> list[dict[str, Any]]:
        ...


class TTLCache:
    """Tiny in-memory cache for GET responses. No Redis in this MVP (consistent with the rest
    of the backend -- see app.core.rate_limit's own in-memory limiter), and provider profile/
    stats/archive data changes slowly enough that a short per-process TTL meaningfully cuts
    duplicate calls without ever serving badly-stale data."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.monotonic() >= expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        self._store[key] = (time.monotonic() + ttl_seconds, value)


async def with_retry(coro_factory, *, max_attempts: int = 4, base_delay: float = 0.5):
    """Retries on IntegrationUnavailableError with exponential backoff -- callers (the Chess.com
    client) raise that specifically for 429/5xx/timeout, so a 404 (PlayerNotFoundError) or any
    other bug surfaces immediately instead of being retried."""
    last_error: IntegrationUnavailableError | None = None
    for attempt in range(max_attempts):
        try:
            return await coro_factory()
        except IntegrationUnavailableError as exc:
            last_error = exc
            if attempt < max_attempts - 1:
                await asyncio.sleep(base_delay * (2**attempt))
    assert last_error is not None
    raise last_error
