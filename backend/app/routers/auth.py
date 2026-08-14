from fastapi import APIRouter, Depends, Request, Response, status

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.exceptions import InvalidCredentialsError
from app.core.rate_limit import rate_limit
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest, UpdateProfileRequest
from app.schemas.common import DataResponse
from app.schemas.user import UserResponse
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


@router.post(
    "/register",
    response_model=DataResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new USER account",
    dependencies=[Depends(rate_limit("register", limit=5, window_seconds=60))],
)
async def register(payload: RegisterRequest, response: Response) -> DataResponse[UserResponse]:
    user = await auth_service.register_user(payload)
    token = auth_service.issue_access_token(user)
    _set_auth_cookie(response, token)
    return DataResponse(data=UserResponse.model_validate(user, from_attributes=True))


@router.post(
    "/login",
    response_model=DataResponse[UserResponse],
    summary="Log in and receive an HTTP-only session cookie",
    dependencies=[Depends(rate_limit("login", limit=10, window_seconds=60))],
)
async def login(payload: LoginRequest, request: Request, response: Response) -> DataResponse[UserResponse]:
    user = await auth_service.authenticate_user(payload)
    if settings.ADMIN_ORIGIN and user.role == UserRole.ADMIN:
        origin = request.headers.get("origin")
        if origin != settings.ADMIN_ORIGIN:
            # Same error as wrong credentials -- don't reveal that the password was
            # actually correct but the origin wasn't the admin site.
            raise InvalidCredentialsError()
    token = auth_service.issue_access_token(user)
    _set_auth_cookie(response, token)
    return DataResponse(data=UserResponse.model_validate(user, from_attributes=True))


@router.post("/logout", summary="Log out and clear the session cookie")
async def logout(response: Response) -> DataResponse[dict]:
    response.delete_cookie(key=settings.COOKIE_NAME, path="/")
    return DataResponse(data={"message": "Logged out successfully."})


@router.get("/me", response_model=DataResponse[UserResponse], summary="Get the current authenticated user")
async def me(current_user: User = Depends(get_current_user)) -> DataResponse[UserResponse]:
    return DataResponse(data=UserResponse.model_validate(current_user, from_attributes=True))


@router.put(
    "/me",
    response_model=DataResponse[UserResponse],
    summary="Update the current user's name/phone",
)
async def update_me(
    payload: UpdateProfileRequest, current_user: User = Depends(get_current_user)
) -> DataResponse[UserResponse]:
    user = await auth_service.update_profile(current_user, payload)
    return DataResponse(data=UserResponse.model_validate(user, from_attributes=True))
