from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, model_validator

from app.models.scoring_rule import ScoringMethod


class ScoringRuleUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    method: ScoringMethod
    placement_points: dict[str, float] | None = None
    kill_point_value: float | None = None
    field_weights: dict[str, float] | None = None
    tie_break_fields: list[str] = []

    @model_validator(mode="after")
    def method_has_required_config(self) -> "ScoringRuleUpsert":
        if self.method in (ScoringMethod.PLACEMENT_ONLY, ScoringMethod.PLACEMENT_AND_KILLS) and not self.placement_points:
            raise ValueError(f"placement_points is required for {self.method.value}.")
        if self.method == ScoringMethod.PLACEMENT_AND_KILLS and self.kill_point_value is None:
            raise ValueError("kill_point_value is required for PLACEMENT_AND_KILLS.")
        if self.method == ScoringMethod.CUSTOM_FORMULA and not self.field_weights:
            raise ValueError("field_weights is required for CUSTOM_FORMULA.")
        return self


class ScoringRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    tournament_id: PydanticObjectId
    version: int
    method: ScoringMethod
    placement_points: dict[str, float] | None
    kill_point_value: float | None
    field_weights: dict[str, float] | None
    tie_break_fields: list[str]
    is_active: bool
