from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict

from app.models.result_import import ImportRowStatus, ImportStatus


class ImportRowReportResponse(BaseModel):
    row_number: int
    game_uid: str | None
    placement: int | None
    kills: int | None
    row_status: ImportRowStatus
    reason: str | None
    user_id: PydanticObjectId | None


class ResultImportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    tournament_id: PydanticObjectId
    match_id: PydanticObjectId
    filename: str
    imported_by: PydanticObjectId
    row_count: int
    valid_count: int
    invalid_count: int
    duplicate_count: int
    unknown_count: int
    missing_game_uids: list[str]
    status: ImportStatus
    rows: list[ImportRowReportResponse]
    created_at: datetime
