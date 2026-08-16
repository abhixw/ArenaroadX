import httpx
import pytest

from app.integrations.base import IntegrationUnavailableError, PlayerNotFoundError
from app.integrations.chess_com import ChessComIntegration

pytestmark = pytest.mark.asyncio


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=None)


class _FakeClient:
    """Stand-in for httpx.AsyncClient -- returns queued responses in order, one per .get()
    call, so tests can script exactly what the "provider" says without any real network call.
    `responses` is shared (not copied) across instances, since chess_com.py opens a fresh
    AsyncClient per retry attempt -- the queue must drain across all of them."""

    def __init__(self, *args, responses=None, **kwargs):
        self.responses = responses if responses is not None else []
        self.calls: list[str] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, **kwargs):
        self.calls.append(url)
        if not self.responses:
            raise AssertionError("no more fake responses queued")
        return self.responses.pop(0)


def _patch_client(monkeypatch, responses):
    calls_holder: list[_FakeClient] = []

    def factory(*args, **kwargs):
        client = _FakeClient(*args, responses=responses, **kwargs)
        calls_holder.append(client)
        return client

    monkeypatch.setattr("app.integrations.chess_com.httpx.AsyncClient", factory)
    return calls_holder


async def test_verify_account_success(monkeypatch):
    _patch_client(
        monkeypatch,
        [_FakeResponse(200, {"player_id": 12345, "username": "testplayer", "name": "Test Player", "avatar": "https://x/a.png"})],
    )
    integ = ChessComIntegration()

    profile = await integ.verify_account("TestPlayer")

    assert profile.provider_player_id == "12345"
    assert profile.display_name == "Test Player"
    assert profile.avatar_url == "https://x/a.png"


async def test_verify_account_not_found(monkeypatch):
    _patch_client(monkeypatch, [_FakeResponse(404)])
    integ = ChessComIntegration()

    with pytest.raises(PlayerNotFoundError):
        await integ.verify_account("nobody")


async def test_verify_account_retries_on_429_then_succeeds(monkeypatch):
    calls = _patch_client(
        monkeypatch,
        [
            _FakeResponse(429),
            _FakeResponse(429),
            _FakeResponse(200, {"player_id": 1, "username": "u", "name": None, "avatar": None}),
        ],
    )
    integ = ChessComIntegration()

    profile = await integ.verify_account("u")

    assert profile.provider_player_id == "1"
    # 3 separate httpx.AsyncClient() context managers, one per retry attempt.
    assert len(calls) == 3


async def test_verify_account_exhausts_retries_and_raises(monkeypatch):
    _patch_client(monkeypatch, [_FakeResponse(429)] * 10)
    integ = ChessComIntegration()

    with pytest.raises(IntegrationUnavailableError):
        await integ.verify_account("u")


async def test_get_stats_and_cache_avoids_second_call(monkeypatch):
    calls = _patch_client(monkeypatch, [_FakeResponse(200, {"chess_rapid": {"last": {"rating": 1500}}})])
    integ = ChessComIntegration()

    stats1 = await integ.get_stats("u")
    stats2 = await integ.get_stats("u")

    assert stats1 == stats2
    assert len(calls) == 1  # second call served from cache, no second AsyncClient created


async def test_list_archive_periods_parses_urls(monkeypatch):
    _patch_client(
        monkeypatch,
        [
            _FakeResponse(
                200,
                {
                    "archives": [
                        "https://api.chess.com/pub/player/u/games/2026/06",
                        "https://api.chess.com/pub/player/u/games/2026/07",
                    ]
                },
            )
        ],
    )
    integ = ChessComIntegration()

    periods = await integ.list_archive_periods("u")

    assert periods == ["2026/06", "2026/07"]


async def test_get_games_for_period(monkeypatch):
    _patch_client(monkeypatch, [_FakeResponse(200, {"games": [{"url": "g1"}, {"url": "g2"}]})])
    integ = ChessComIntegration()

    games = await integ.get_games_for_period("u", "2026/06")

    assert len(games) == 2
