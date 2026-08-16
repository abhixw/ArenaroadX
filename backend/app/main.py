import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.audit_middleware import AuditLogMiddleware
from app.core.config import settings, validate_production_config
from app.core.database import init_db
from app.core.exceptions import AppError
from app.core.security_headers_middleware import SecurityHeadersMiddleware
from app.models import ALL_DOCUMENT_MODELS
from app.routers import (
    audit_logs,
    auth,
    game_accounts,
    games,
    leaderboard,
    matches,
    payments,
    prizes,
    refunds,
    registrations,
    result_imports,
    results,
    tournaments,
    users,
)

logger = logging.getLogger("tournament_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    problems = validate_production_config(settings)
    if problems:
        raise RuntimeError(
            "Refusing to start with ENVIRONMENT=production and an unsafe configuration:\n- "
            + "\n- ".join(problems)
        )
    await init_db(document_models=ALL_DOCUMENT_MODELS)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for a Gaming Tournament Management Platform (Chess, Smash Karts, BGMI, Free Fire, and more).",
    version="0.2.0",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(AuditLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Added last so it's outermost -- runs on every response, including CORS preflights and
# unhandled-exception responses, not just ones that reach the router.
app.add_middleware(SecurityHeadersMiddleware)


def _with_cors_headers(request: Request, response: JSONResponse) -> JSONResponse:
    """FastAPI's bare-Exception handler runs inside Starlette's ServerErrorMiddleware, which
    sits *outside* CORSMiddleware (see Starlette's Starlette.build_middleware_stack) -- so any
    response built here never gets CORSMiddleware's headers and the browser reports a
    confusing "CORS policy" error instead of the real one. Add them manually."""
    origin = request.headers.get("origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.error_code, "message": exc.message}},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception while processing %s %s", request.method, request.url.path)
    message = str(exc) if settings.DEBUG else "An unexpected error occurred."
    response = JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_SERVER_ERROR", "message": message}},
    )
    return _with_cors_headers(request, response)


app.include_router(auth.router)
app.include_router(games.router)
app.include_router(games.admin_router)
app.include_router(tournaments.router)
app.include_router(tournaments.admin_router)
app.include_router(game_accounts.router)
app.include_router(game_accounts.my_accounts_router)
app.include_router(registrations.router)
app.include_router(registrations.my_tournaments_router)
app.include_router(registrations.admin_tournament_router)
app.include_router(registrations.admin_registrations_router)
app.include_router(registrations.admin_players_router)
app.include_router(payments.router)
app.include_router(payments.admin_router)
app.include_router(payments.webhook_router)
app.include_router(matches.router)
app.include_router(matches.admin_tournament_router)
app.include_router(matches.admin_matches_router)
app.include_router(results.router)
app.include_router(results.admin_matches_router)
app.include_router(results.admin_results_router)
app.include_router(results.admin_tournament_router)
app.include_router(leaderboard.router)
app.include_router(leaderboard.users_router)
app.include_router(result_imports.router)
app.include_router(prizes.router)
app.include_router(prizes.users_router)
app.include_router(prizes.admin_tournament_router)
app.include_router(prizes.admin_prizes_router)
app.include_router(refunds.admin_tournament_router)
app.include_router(refunds.admin_refunds_router)
app.include_router(audit_logs.router)
app.include_router(users.admin_router)


@app.get("/debug-auth", tags=["health"], summary="TEMP: live password-verify probe")
async def debug_auth(email: str, password: str) -> dict[str, str]:
    from app.core.security import verify_password
    from app.repositories import user_repository

    user = await user_repository.get_by_email(email)
    if user is None:
        return {"result": "USER_NOT_FOUND"}
    matches = verify_password(password, user.password_hash)
    return {
        "result": "MATCH" if matches else "NO_MATCH",
        "user_id": str(user.id),
        "role": user.role.value,
        "hash_prefix": user.password_hash[:20],
    }


@app.get("/", tags=["health"], summary="Health check")
async def root() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
    }
