from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.registration import RegistrationPaymentStatus, RegistrationStatus
from app.schemas.tournament import TournamentResponse
from app.schemas.user import UserResponse


class RegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    user_id: PydanticObjectId
    tournament_id: PydanticObjectId
    game_account_id: PydanticObjectId
    game_uid: str
    payment_id: PydanticObjectId | None
    registration_status: RegistrationStatus
    payment_status: RegistrationPaymentStatus
    reserved_until: datetime
    disqualification_reason: str | None
    created_at: datetime


class MyTournamentResponse(BaseModel):
    registration_id: PydanticObjectId
    registration_status: RegistrationStatus
    payment_status: RegistrationPaymentStatus
    reserved_until: datetime
    registered_at: datetime
    tournament: TournamentResponse


class ParticipantResponse(BaseModel):
    registration_id: PydanticObjectId
    user_id: PydanticObjectId
    name: str
    email: str
    game_uid: str
    payment_status: RegistrationPaymentStatus
    registration_status: RegistrationStatus


class PlayerHistoryResponse(BaseModel):
    user: UserResponse
    registrations: list[MyTournamentResponse]


class DisqualifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A disqualification reason is required.")
        return value
