import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
NAME_MAX_LENGTH = 120
PHONE_PATTERN = re.compile(r"^\+?\d{10,15}$")


def validate_password_strength(value: str) -> str:
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long.")
    if not re.search(r"[A-Z]", value):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", value):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", value):
        raise ValueError("Password must contain at least one digit.")
    return value


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=NAME_MAX_LENGTH)
    email: EmailStr
    password: str = Field(max_length=PASSWORD_MAX_LENGTH)
    phone: str

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be empty.")
        return value

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, value: str) -> str:
        if not PHONE_PATTERN.match(value):
            raise ValueError("Phone number must be 10-15 digits, with an optional leading +.")
        return value

    @field_validator("password")
    @classmethod
    def password_strong(cls, value: str) -> str:
        return validate_password_strength(value)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(max_length=PASSWORD_MAX_LENGTH)


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(max_length=512)
    new_password: str = Field(max_length=PASSWORD_MAX_LENGTH)

    @field_validator("new_password")
    @classmethod
    def password_strong(cls, value: str) -> str:
        return validate_password_strength(value)


class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=NAME_MAX_LENGTH)
    phone: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Name must not be empty.")
        return value

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not PHONE_PATTERN.match(value):
            raise ValueError("Phone number must be 10-15 digits, with an optional leading +.")
        return value
