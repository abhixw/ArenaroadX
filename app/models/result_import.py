import enum

from beanie import PydanticObjectId
from pydantic import BaseModel
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseDocument


class ImportStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    VALIDATED = "VALIDATED"
    COMMITTED = "COMMITTED"


class ImportRowStatus(str, enum.Enum):
    VALID = "VALID"
    INVALID = "INVALID"
    DUPLICATE = "DUPLICATE"
    UNKNOWN = "UNKNOWN"


class ImportRowReport(BaseModel):
    row_number: int
    game_uid: str | None
    placement: int | None = None
    kills: int | None = None
    raw: dict = {}
    row_status: ImportRowStatus
    reason: str | None = None
    user_id: PydanticObjectId | None = None


class ResultImport(BaseDocument):
    tournament_id: PydanticObjectId
    match_id: PydanticObjectId
    filename: str
    imported_by: PydanticObjectId
    # Original file content, retained verbatim for auditability (spec section 9).
    raw_csv_text: str
    rows: list[ImportRowReport] = []
    row_count: int = 0
    valid_count: int = 0
    invalid_count: int = 0
    duplicate_count: int = 0
    unknown_count: int = 0
    # Registered match participants with no row in the file at all.
    missing_game_uids: list[str] = []
    status: ImportStatus = ImportStatus.UPLOADED

    class Settings:
        name = "result_imports"
        indexes = [
            IndexModel([("match_id", ASCENDING)], name="ix_result_imports_match_id"),
            IndexModel([("tournament_id", ASCENDING)], name="ix_result_imports_tournament_id"),
        ]
