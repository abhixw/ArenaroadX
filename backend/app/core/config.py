from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "Tournament Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database (MongoDB)
    MONGODB_URL: str
    MONGODB_DB_NAME: str = "tournament_platform"
    TEST_MONGODB_URL: str = ""
    TEST_MONGODB_DB_NAME: str = "tournament_platform_test"

    # JWT / auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Cookie
    COOKIE_NAME: str = "access_token"
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # CORS -- comma-separated list of allowed frontend origins
    CORS_ORIGINS: str = "http://localhost:5173"

    # If set, ADMIN-role accounts may only log in from this exact origin (the admin
    # frontend's deployed URL) -- an admin's credentials are rejected from the player
    # site even if correct. Left blank, this check is disabled (e.g. local dev where
    # both dashboards may legitimately share credentials during testing).
    ADMIN_ORIGIN: str = ""

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # Registration slot reservation window (no background worker in this MVP, so expiry
    # is swept lazily -- see registration_service._sweep_expired_reservations)
    REGISTRATION_RESERVATION_MINUTES: int = 15

    # Initial admin seed (used only by scripts/create_admin.py, never via API)
    INITIAL_ADMIN_EMAIL: str = ""
    INITIAL_ADMIN_PASSWORD: str = ""
    INITIAL_ADMIN_NAME: str = "Admin"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


_PLACEHOLDER_MARKERS = ("placeholder", "change", "test_secret", "example")


def _looks_like_placeholder(value: str) -> bool:
    lowered = value.lower()
    return any(marker in lowered for marker in _PLACEHOLDER_MARKERS)


def validate_production_config(s: Settings) -> list[str]:
    """Returns a list of problems that must never ship to production -- called once at
    startup (see app.main.lifespan) so a misconfigured deploy fails loudly at boot instead
    of silently running with debug info exposed, broken webhooks, or a forgeable session."""
    if s.ENVIRONMENT != "production":
        return []

    problems: list[str] = []
    if s.DEBUG:
        problems.append("DEBUG must be false in production (it puts internal error details in API responses).")
    if len(s.JWT_SECRET_KEY) < 32 or _looks_like_placeholder(s.JWT_SECRET_KEY):
        problems.append("JWT_SECRET_KEY is missing, too short, or looks like a placeholder -- sessions would be forgeable.")
    if not s.COOKIE_SECURE:
        problems.append("COOKIE_SECURE must be true in production (the auth cookie would be sent over plain HTTP).")
    if s.COOKIE_SAMESITE.lower() == "lax" and s.CORS_ORIGINS:
        # Not fatal on its own (same-site deployments are valid), but Render+Vercel's
        # cross-domain default needs SameSite=None or the cookie silently never arrives.
        pass
    if not s.RAZORPAY_KEY_ID or not s.RAZORPAY_KEY_SECRET or _looks_like_placeholder(s.RAZORPAY_KEY_SECRET):
        problems.append("RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are missing or look like placeholders.")
    elif s.RAZORPAY_KEY_ID.startswith("rzp_test_"):
        problems.append("RAZORPAY_KEY_ID is a TEST-mode key (rzp_test_...) -- real players cannot pay with this in production.")
    if not s.RAZORPAY_WEBHOOK_SECRET or _looks_like_placeholder(s.RAZORPAY_WEBHOOK_SECRET):
        problems.append("RAZORPAY_WEBHOOK_SECRET is missing or a placeholder -- webhook events would be silently rejected.")
    if not s.CORS_ORIGINS or "localhost" in s.CORS_ORIGINS or "127.0.0.1" in s.CORS_ORIGINS:
        problems.append("CORS_ORIGINS must be set to the real deployed frontend origin(s), not localhost.")
    return problems
