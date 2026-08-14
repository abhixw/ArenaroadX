from app.core.exceptions import ScoringDataMissingError
from app.models.match_result import MatchResult
from app.models.scoring_rule import ScoringMethod, ScoringRule


def calculate(rule: ScoringRule, match_result: MatchResult) -> tuple[float, float, float, float]:
    """Returns (placement_points, kill_points, bonus_points, total_score).

    Deliberately a bounded, config-driven calculation (placement lookup table + linear
    weighted sum) rather than an arbitrary formula parser -- admin-supplied scoring config
    is never eval()'d.
    """
    if rule.method == ScoringMethod.MANUAL_TOTAL_SCORE:
        total = match_result.raw_data.get("total_score")
        if total is None:
            raise ScoringDataMissingError("raw_data.total_score is required for the MANUAL_TOTAL_SCORE method.")
        return (0.0, 0.0, 0.0, float(total))

    placement_points = 0.0
    if rule.method in (ScoringMethod.PLACEMENT_ONLY, ScoringMethod.PLACEMENT_AND_KILLS):
        if match_result.placement is None:
            raise ScoringDataMissingError(f"placement is required for the {rule.method.value} method.")
        placement_points = (rule.placement_points or {}).get(str(match_result.placement), 0.0)

    kill_points = 0.0
    if rule.method == ScoringMethod.PLACEMENT_AND_KILLS:
        if match_result.kills is None:
            raise ScoringDataMissingError("kills is required for the PLACEMENT_AND_KILLS method.")
        kill_points = (rule.kill_point_value or 0.0) * match_result.kills

    bonus_points = 0.0
    if rule.method == ScoringMethod.CUSTOM_FORMULA:
        for field, weight in (rule.field_weights or {}).items():
            value = match_result.raw_data.get(field, 0)
            bonus_points += weight * value

    total = placement_points + kill_points + bonus_points
    return (placement_points, kill_points, bonus_points, total)


def _tie_break_key(rule: ScoringRule, match_result: MatchResult | None) -> tuple:
    if match_result is None:
        return ()
    key = []
    for field in rule.tie_break_fields:
        if field == "placement":
            # Lower placement is better -- negate so the shared descending sort still works.
            value = match_result.placement if match_result.placement is not None else float("inf")
            key.append(-value)
        else:
            value = getattr(match_result, field, None)
            if value is None:
                value = match_result.raw_data.get(field, 0)
            key.append(value)
    return tuple(key)


def sort_key(rule: ScoringRule, total_score: float, match_result: MatchResult | None) -> tuple:
    """Higher is better throughout -- use with sorted(..., reverse=True)."""
    return (total_score, *_tie_break_key(rule, match_result))
