import { http } from "@shared/api/client";
import {
  mapMatchResult,
  mapScoringRule,
  mapTournamentResult,
  type MatchResultDto,
  type ScoringRuleDto,
  type TournamentResultDto,
} from "@/lib/adminMappers";
import type { MatchResult, ResultRevision, ScoringMethod, ScoringRule, TournamentResult } from "@/types/admin";

// GET /api/tournaments/{id}/scoring-rule
export async function getScoringRule(tournamentId: string): Promise<ScoringRule> {
  const dto = await http.get<ScoringRuleDto>(`/api/tournaments/${tournamentId}/scoring-rule`);
  return mapScoringRule(dto);
}

export interface ScoringRuleInput {
  method: ScoringMethod;
  placementPoints?: Record<string, number>;
  killPointValue?: number;
  fieldWeights?: Record<string, number>;
  tieBreakFields?: string[];
}

// POST /api/admin/tournaments/{id}/scoring-rule (creates a new version)
export async function upsertScoringRule(tournamentId: string, input: ScoringRuleInput): Promise<ScoringRule> {
  const dto = await http.post<ScoringRuleDto>(`/api/admin/tournaments/${tournamentId}/scoring-rule`, {
    method: input.method,
    placement_points: input.placementPoints ?? null,
    kill_point_value: input.killPointValue ?? null,
    field_weights: input.fieldWeights ?? null,
    tie_break_fields: input.tieBreakFields ?? [],
  });
  return mapScoringRule(dto);
}

// GET /api/admin/matches/{id}/results
export async function listMatchResults(matchId: string): Promise<MatchResult[]> {
  const dtos = await http.get<MatchResultDto[]>(`/api/admin/matches/${matchId}/results`);
  return dtos.map(mapMatchResult);
}

// POST /api/admin/matches/{id}/results/manual
export async function enterMatchResult(
  matchId: string,
  input: { gameUid: string; placement?: number; kills?: number; evidenceReference?: string },
): Promise<MatchResult> {
  const dto = await http.post<MatchResultDto>(`/api/admin/matches/${matchId}/results/manual`, {
    game_uid: input.gameUid,
    placement: input.placement ?? null,
    kills: input.kills ?? null,
    evidence_reference: input.evidenceReference || undefined,
  });
  return mapMatchResult(dto);
}

// PUT /api/admin/results/{matchResultId} -- before publication
export async function updateMatchResult(
  matchResultId: string,
  input: { placement?: number; kills?: number },
): Promise<MatchResult> {
  const dto = await http.put<MatchResultDto>(`/api/admin/results/${matchResultId}`, {
    ...(input.placement !== undefined ? { placement: input.placement } : {}),
    ...(input.kills !== undefined ? { kills: input.kills } : {}),
  });
  return mapMatchResult(dto);
}

// POST /api/admin/results/{matchResultId}/correction -- may already be published; audited
export async function correctMatchResult(
  matchResultId: string,
  input: { placement?: number; kills?: number; reason: string },
): Promise<{ matchResult: MatchResult; revision: ResultRevision }> {
  const dto = await http.post<{
    match_result: MatchResultDto;
    revision: {
      id: string;
      tournament_id: string;
      match_result_id: string;
      tournament_result_id: string;
      user_id: string;
      changed_by: string;
      reason: string;
      changes: Record<string, { old: unknown; new: unknown }>;
      old_rank: number | null;
      new_rank: number | null;
      old_total_score: number | null;
      new_total_score: number | null;
      financial_impact_flagged: boolean;
      created_at: string;
    };
  }>(`/api/admin/results/${matchResultId}/correction`, {
    ...(input.placement !== undefined ? { placement: input.placement } : {}),
    ...(input.kills !== undefined ? { kills: input.kills } : {}),
    reason: input.reason,
  });
  return {
    matchResult: mapMatchResult(dto.match_result),
    revision: {
      id: String(dto.revision.id),
      tournamentId: String(dto.revision.tournament_id),
      matchResultId: String(dto.revision.match_result_id),
      tournamentResultId: String(dto.revision.tournament_result_id),
      userId: String(dto.revision.user_id),
      changedBy: String(dto.revision.changed_by),
      reason: dto.revision.reason,
      changes: dto.revision.changes,
      oldRank: dto.revision.old_rank,
      newRank: dto.revision.new_rank,
      oldTotalScore: dto.revision.old_total_score,
      newTotalScore: dto.revision.new_total_score,
      financialImpactFlagged: dto.revision.financial_impact_flagged,
      createdAt: dto.revision.created_at,
    },
  };
}

// GET /api/tournaments/{id}/results (published/calculated results, any status visible to admin)
export async function listTournamentResults(tournamentId: string): Promise<TournamentResult[]> {
  const dtos = await http.get<TournamentResultDto[]>(`/api/tournaments/${tournamentId}/results`);
  return dtos.map(mapTournamentResult);
}

// POST /api/admin/tournaments/{id}/review-results
export async function reviewResults(tournamentId: string): Promise<TournamentResult[]> {
  const dtos = await http.post<TournamentResultDto[]>(`/api/admin/tournaments/${tournamentId}/review-results`);
  return dtos.map(mapTournamentResult);
}

// POST /api/admin/tournaments/{id}/publish-results
export async function publishResults(tournamentId: string): Promise<TournamentResult[]> {
  const dtos = await http.post<TournamentResultDto[]>(`/api/admin/tournaments/${tournamentId}/publish-results`);
  return dtos.map(mapTournamentResult);
}
