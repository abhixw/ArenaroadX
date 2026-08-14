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
