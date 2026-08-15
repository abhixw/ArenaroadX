from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, UploadFile, status
from fastapi.responses import PlainTextResponse

from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import FileTooLargeError, InvalidFileEncodingError
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.schemas.common import DataResponse
from app.schemas.result_import import ResultImportResponse
from app.services import result_import_service

router = APIRouter(prefix="/api/admin", tags=["admin:result-imports"], dependencies=[Depends(require_admin)])

_MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024  # 2 MB is generous for a per-tournament result CSV


@router.get("/results/csv-template", summary="Download the CSV template for result import (admin only)")
async def download_csv_template() -> PlainTextResponse:
    return PlainTextResponse(content=result_import_service.CSV_TEMPLATE, media_type="text/csv")


@router.post(
    "/matches/{match_id}/results/import",
    response_model=DataResponse[ResultImportResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a CSV of raw match results for validation before committing (admin only)",
    dependencies=[Depends(rate_limit("result-import", limit=10, window_seconds=60))],
)
async def upload_import(
    match_id: PydanticObjectId, file: UploadFile, current_user: User = Depends(get_current_user)
) -> DataResponse[ResultImportResponse]:
    raw_bytes = await file.read()
    if len(raw_bytes) > _MAX_IMPORT_FILE_BYTES:
        raise FileTooLargeError()
    try:
        raw_csv_text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise InvalidFileEncodingError()

    result_import = await result_import_service.upload_import(
        match_id=match_id,
        filename=file.filename or "upload.csv",
        raw_csv_text=raw_csv_text,
        imported_by=current_user.id,
    )
    return DataResponse(data=ResultImportResponse.model_validate(result_import, from_attributes=True))


@router.get(
    "/result-imports/{import_id}",
    response_model=DataResponse[ResultImportResponse],
    summary="Get a result import, including its validation report/preview (admin only)",
)
async def get_import(import_id: PydanticObjectId) -> DataResponse[ResultImportResponse]:
    result_import = await result_import_service.get_import(import_id)
    return DataResponse(data=ResultImportResponse.model_validate(result_import, from_attributes=True))


@router.post(
    "/result-imports/{import_id}/validate",
    response_model=DataResponse[ResultImportResponse],
    summary="Parse and validate every row of an uploaded import; reports valid/invalid/duplicate/unknown/missing (admin only)",
)
async def validate_import(import_id: PydanticObjectId) -> DataResponse[ResultImportResponse]:
    result_import = await result_import_service.validate_import(import_id)
    return DataResponse(data=ResultImportResponse.model_validate(result_import, from_attributes=True))


@router.post(
    "/result-imports/{import_id}/commit",
    response_model=DataResponse[ResultImportResponse],
    summary="Commit only the valid rows of a validated import as real match results (admin only)",
)
async def commit_import(import_id: PydanticObjectId) -> DataResponse[ResultImportResponse]:
    result_import = await result_import_service.commit_import(import_id)
    return DataResponse(data=ResultImportResponse.model_validate(result_import, from_attributes=True))
