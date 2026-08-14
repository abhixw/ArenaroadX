import csv
import io

from beanie import PydanticObjectId

from app.core.exceptions import (
    EmptyCsvFileError,
    MatchNotFoundError,
    ResultImportAlreadyCommittedError,
    ResultImportNotFoundError,
    ResultImportNotValidatedError,
)
from app.models.match_result import MatchResultStatus
from app.models.result_import import ImportRowReport, ImportRowStatus, ImportStatus, ResultImport
from app.repositories import match_participant_repository, match_repository, match_result_repository, result_import_repository
from app.services import result_service

CSV_TEMPLATE = "game_uid,placement,kills\n123456789,1,8\n987654321,2,5\n555555555,3,3\n"

_KNOWN_COLUMNS = {"game_uid", "placement", "kills"}


def _coerce(value: str):
    if value is None or value == "":
        return None
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value


async def upload_import(
    *, match_id: PydanticObjectId, filename: str, raw_csv_text: str, imported_by: PydanticObjectId
) -> ResultImport:
    match = await match_repository.get_by_id(match_id)
    if match is None:
        raise MatchNotFoundError()

    reader = csv.DictReader(io.StringIO(raw_csv_text))
    row_count = sum(1 for _ in reader)
    if row_count == 0:
        raise EmptyCsvFileError()

    return await result_import_repository.create(
        tournament_id=match.tournament_id,
        match_id=match_id,
        filename=filename,
        imported_by=imported_by,
        raw_csv_text=raw_csv_text,
        row_count=row_count,
        status=ImportStatus.UPLOADED,
    )


async def validate_import(import_id: PydanticObjectId) -> ResultImport:
    result_import = await result_import_repository.get_by_id(import_id)
    if result_import is None:
        raise ResultImportNotFoundError()

    participants = await match_participant_repository.list_by_match(result_import.match_id)
    participants_by_uid = {p.game_uid: p for p in participants if p.participation_status != "DISQUALIFIED"}

    existing_results = await match_result_repository.list_by_match(result_import.match_id)
    existing_uids = {r.game_uid for r in existing_results}

    reader = csv.DictReader(io.StringIO(result_import.raw_csv_text))
    seen_in_file: set[str] = set()
    rows: list[ImportRowReport] = []
    counts = {status: 0 for status in ImportRowStatus}

    for row_number, raw_row in enumerate(reader, start=1):
        game_uid = (raw_row.get("game_uid") or "").strip()
        extra = {k: _coerce(v) for k, v in raw_row.items() if k not in _KNOWN_COLUMNS and k is not None}

        if not game_uid:
            rows.append(ImportRowReport(row_number=row_number, game_uid=None, row_status=ImportRowStatus.INVALID, reason="game_uid is required.", raw=extra))
            counts[ImportRowStatus.INVALID] += 1
            continue

        placement = kills = None
        numeric_error = None
        placement_raw = (raw_row.get("placement") or "").strip()
        kills_raw = (raw_row.get("kills") or "").strip()
        if placement_raw:
            try:
                placement = int(placement_raw)
                if placement < 1:
                    numeric_error = "placement must be a positive integer."
            except ValueError:
                numeric_error = "placement must be an integer."
        if kills_raw and numeric_error is None:
            try:
                kills = int(kills_raw)
                if kills < 0:
                    numeric_error = "kills must not be negative."
            except ValueError:
                numeric_error = "kills must be an integer."

        if numeric_error:
            rows.append(ImportRowReport(row_number=row_number, game_uid=game_uid, placement=placement, kills=kills, row_status=ImportRowStatus.INVALID, reason=numeric_error, raw=extra))
            counts[ImportRowStatus.INVALID] += 1
            continue

        if game_uid in seen_in_file:
            rows.append(ImportRowReport(row_number=row_number, game_uid=game_uid, placement=placement, kills=kills, row_status=ImportRowStatus.DUPLICATE, reason="Duplicate game_uid within this file.", raw=extra))
            counts[ImportRowStatus.DUPLICATE] += 1
            continue

        participant = participants_by_uid.get(game_uid)
        if participant is None:
            rows.append(ImportRowReport(row_number=row_number, game_uid=game_uid, placement=placement, kills=kills, row_status=ImportRowStatus.UNKNOWN, reason="Game UID is not a registered participant in this match.", raw=extra))
            counts[ImportRowStatus.UNKNOWN] += 1
            continue

        if game_uid in existing_uids:
            seen_in_file.add(game_uid)
            rows.append(ImportRowReport(row_number=row_number, game_uid=game_uid, placement=placement, kills=kills, row_status=ImportRowStatus.DUPLICATE, reason="A result already exists for this participant.", user_id=participant.user_id, raw=extra))
            counts[ImportRowStatus.DUPLICATE] += 1
            continue

        seen_in_file.add(game_uid)
        rows.append(ImportRowReport(row_number=row_number, game_uid=game_uid, placement=placement, kills=kills, row_status=ImportRowStatus.VALID, user_id=participant.user_id, raw=extra))
        counts[ImportRowStatus.VALID] += 1

    missing = sorted(set(participants_by_uid.keys()) - seen_in_file)

    return await result_import_repository.update(
        result_import,
        rows=rows,
        row_count=len(rows),
        valid_count=counts[ImportRowStatus.VALID],
        invalid_count=counts[ImportRowStatus.INVALID],
        duplicate_count=counts[ImportRowStatus.DUPLICATE],
        unknown_count=counts[ImportRowStatus.UNKNOWN],
        missing_game_uids=missing,
        status=ImportStatus.VALIDATED,
    )


async def get_import(import_id: PydanticObjectId) -> ResultImport:
    result_import = await result_import_repository.get_by_id(import_id)
    if result_import is None:
        raise ResultImportNotFoundError()
    return result_import


async def commit_import(import_id: PydanticObjectId) -> ResultImport:
    result_import = await get_import(import_id)
    if result_import.status == ImportStatus.COMMITTED:
        raise ResultImportAlreadyCommittedError()
    if result_import.status != ImportStatus.VALIDATED:
        raise ResultImportNotValidatedError()

    rule = await result_service.get_active_scoring_rule(result_import.tournament_id)

    created_any = False
    for row in result_import.rows:
        if row.row_status != ImportRowStatus.VALID:
            continue
        match_result = await match_result_repository.create(
            match_id=result_import.match_id,
            tournament_id=result_import.tournament_id,
            user_id=row.user_id,
            game_uid=row.game_uid,
            placement=row.placement,
            kills=row.kills,
            raw_data=row.raw,
            source="ADMIN_IMPORT",
            evidence_reference=str(result_import.id),
            status=MatchResultStatus.VALIDATED,
        )
        await result_service.recalculate_tournament_result(rule, match_result)
        created_any = True

    if created_any:
        await result_service.recompute_ranks(result_import.tournament_id, rule)

    return await result_import_repository.update(result_import, status=ImportStatus.COMMITTED)
