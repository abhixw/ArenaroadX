from typing import Any

import httpx

from app.integrations.base import (
    GameIntegration,
    IntegrationUnavailableError,
    PlayerNotFoundError,
    TTLCache,
    VerifiedProfile,
    with_retry,
)

_BASE_URL = "https://api.chess.com/pub"
# Chess.com asks API consumers to identify themselves; an unset/generic User-Agent is one of
# the documented reasons they cite for blocking a client.
_USER_AGENT = "ArenaroadX/1.0 (tournament platform; contact: admin@arenaroadx.com)"

# Profile/stats/archive-list data changes slowly -- a short cache meaningfully cuts duplicate
# calls (e.g. a player re-submitting the same username, or an admin reviewing a match twice)
# without ever serving stale-enough data to matter.
_PROFILE_TTL_SECONDS = 300
_ARCHIVE_MONTH_TTL_SECONDS = 3600  # a past month's games never change; only this month's would


class ChessComIntegration(GameIntegration):
    key = "chess_com"

    def __init__(self) -> None:
        self._cache = TTLCache()

    async def _get(self, path: str) -> dict[str, Any]:
        async def _request() -> dict[str, Any]:
            async with httpx.AsyncClient(timeout=10.0) as client:
                try:
                    response = await client.get(f"{_BASE_URL}{path}", headers={"User-Agent": _USER_AGENT})
                except httpx.TimeoutException as exc:
                    raise IntegrationUnavailableError(f"Chess.com request timed out: {path}") from exc
                except httpx.HTTPError as exc:
                    raise IntegrationUnavailableError(f"Chess.com request failed: {path}") from exc

            if response.status_code == 404:
                raise PlayerNotFoundError(path)
            if response.status_code == 429 or response.status_code >= 500:
                raise IntegrationUnavailableError(f"Chess.com returned {response.status_code} for {path}")
            response.raise_for_status()
            return response.json()

        return await with_retry(_request)

    async def _get_cached(self, path: str, ttl_seconds: float) -> dict[str, Any]:
        cached = self._cache.get(path)
        if cached is not None:
            return cached
        result = await self._get(path)
        self._cache.set(path, result, ttl_seconds)
        return result

    async def verify_account(self, uid: str) -> VerifiedProfile:
        username = uid.strip().lower()
        profile = await self._get_cached(f"/player/{username}", _PROFILE_TTL_SECONDS)
        return VerifiedProfile(
            provider_player_id=str(profile["player_id"]),
            display_name=profile.get("name") or profile.get("username"),
            avatar_url=profile.get("avatar"),
            raw=profile,
        )

    async def get_stats(self, uid: str) -> dict[str, Any]:
        username = uid.strip().lower()
        return await self._get_cached(f"/player/{username}/stats", _PROFILE_TTL_SECONDS)

    async def list_archive_periods(self, uid: str) -> list[str]:
        username = uid.strip().lower()
        data = await self._get_cached(f"/player/{username}/games/archives", _PROFILE_TTL_SECONDS)
        # Archive URLs look like ".../games/2026/06" -- the trailing "YYYY/MM" is the period.
        return ["/".join(url.rstrip("/").split("/")[-2:]) for url in data.get("archives", [])]

    async def get_games_for_period(self, uid: str, period: str) -> list[dict[str, Any]]:
        username = uid.strip().lower()
        year, month = period.split("/")
        data = await self._get_cached(f"/player/{username}/games/{year}/{month}", _ARCHIVE_MONTH_TTL_SECONDS)
        return data.get("games", [])
