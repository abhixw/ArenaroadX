from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, status

from app.core.dependencies import get_current_user, require_admin, require_user
from app.models.user import User
from app.schemas.common import DataResponse, ListResponse
from app.schemas.result import (
    CorrectionResponse,
    MatchResultCorrection,
    MatchResultCreate,
    MatchResultResponse,
    MatchResultUpdate,
    ResultRevisionResponse,
    TournamentResultResponse,
)
from app.schemas.scoring_rule import ScoringRuleResponse, ScoringRuleUpsert
from app.services import result_service

router = APIRouter(prefix="/api/tournaments", tags=["results"])
admin_matches_router = APIRouter(
    prefix="/api/admin/matches", tags=["admin:results"], dependencies=[Depends(require_admin)]
)
admin_results_router = APIRouter(
    prefix="/api/admin/results", tags=["admin:results"], dependencies=[Depends(require_admin)]
)
admin_tournament_router = APIRouter(
    prefix="/api/admin/tournaments", tags=["admin:results"], dependencies=[Depends(require_admin)]
)


@router.get(
    "/{tournament_id}/results",
    response_model=ListResponse[TournamentResultResponse],
    summary="List published (calculated) results for a tournament",
    dependencies=[Depends(require_user)],
)
async def list_results(tournament_id: PydanticObjectId) -> ListResponse[TournamentResultResponse]:
    results = await result_service.list_published_results(tournament_id)
    return ListResponse(data=[TournamentResultResponse.model_validate(r, from_attributes=True) for r in results])


@router.get(
    "/{tournament_id}/scoring-rule",
    response_model=DataResponse[ScoringRuleResponse],
    summary="Get the active scoring rule for a tournament",
    dependencies=[Depends(require_user)],
)
async def get_scoring_rule(tournament_id: PydanticObjectId) -> DataResponse[ScoringRuleResponse]:
    rule = await result_service.get_active_scoring_rule(tournament_id)
    return DataResponse(data=ScoringRuleResponse.model_validate(rule, from_attributes=True))


@admin_tournament_router.post(
    "/{tournament_id}/scoring-rule",
    response_model=DataResponse[ScoringRuleResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Configure the scoring rule for a tournament (admin only; creates a new version)",
)
async def upsert_scoring_rule(
    tournament_id: PydanticObjectId, payload: ScoringRuleUpsert
) -> DataResponse[ScoringRuleResponse]:
    rule = await result_service.upsert_scoring_rule(tournament_id, payload)
    return DataResponse(data=ScoringRuleResponse.model_validate(rule, from_attributes=True))


@admin_matches_router.post(
    "/{match_id}/results/manual",
    response_model=DataResponse[MatchResultResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Manually enter a raw match result by Game UID (admin only)",
)
async def enter_match_result(
    match_id: PydanticObjectId, payload: MatchResultCreate
) -> DataResponse[MatchResultResponse]:
    result = await result_service.enter_match_result(match_id, payload)
    return DataResponse(data=MatchResultResponse.model_validate(result, from_attributes=True))


@admin_results_router.put(
    "/{match_result_id}",
    response_model=DataResponse[MatchResultResponse],
    summary="Correct a raw match result before publication (admin only; recalculates the tournament result)",
)
async def update_match_result(
    match_result_id: PydanticObjectId, payload: MatchResultUpdate
) -> DataResponse[MatchResultResponse]:
    result = await result_service.update_match_result(match_result_id, payload)
    return DataResponse(data=MatchResultResponse.model_validate(result, from_attributes=True))


@admin_results_router.post(
    "/{match_result_id}/correction",
    response_model=DataResponse[CorrectionResponse],
    summary="Correct a result that may already be published (admin only; audited, recalculates ranks/scores)",
)
async def correct_result(
    match_result_id: PydanticObjectId,
    payload: MatchResultCorrection,
    current_user: User = Depends(get_current_user),
) -> DataResponse[CorrectionResponse]:
    match_result, revision = await result_service.correct_result(match_result_id, payload, current_user.id)
    return DataResponse(
        data=CorrectionResponse(
            match_result=MatchResultResponse.model_validate(match_result, from_attributes=True),
            revision=ResultRevisionResponse.model_validate(revision, from_attributes=True),
        )
    )


@admin_tournament_router.post(
    "/{tournament_id}/review-results",
    response_model=ListResponse[TournamentResultResponse],
    summary="Bulk-approve all draft calculated results for a tournament (admin only)",
)
async def review_results(tournament_id: PydanticObjectId) -> ListResponse[TournamentResultResponse]:
    results = await result_service.review_results(tournament_id)
    return ListResponse(data=[TournamentResultResponse.model_validate(r, from_attributes=True) for r in results])


@admin_tournament_router.post(
    "/{tournament_id}/publish-results",
    response_model=ListResponse[TournamentResultResponse],
    summary="Publish all approved results for a tournament (admin only); locks them against casual edits",
)
async def publish_results(tournament_id: PydanticObjectId) -> ListResponse[TournamentResultResponse]:
    results = await result_service.publish_results(tournament_id)
    return ListResponse(data=[TournamentResultResponse.model_validate(r, from_attributes=True) for r in results])
