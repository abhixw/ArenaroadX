import { http } from "@shared/api/client";
import { mapAdminMatch, type AdminMatchDto } from "@/lib/adminMappers";
import type { Match } from "@shared/types";

export interface MatchInput {
  matchNumber: number;
  scheduledTime: string;
  joinWindowOpensAt: string;
  joinWindowClosesAt: string;
  roomId?: string;
  roomPassword?: string;
  accessInfo?: string;
}

// GET /api/admin/tournaments/{id}/matches -- includes room credentials (admin only)
export async function listMatches(tournamentId: string): Promise<Match[]> {
  const dtos = await http.get<AdminMatchDto[]>(`/api/admin/tournaments/${tournamentId}/matches`);
  return dtos.map(mapAdminMatch);
}

// POST /api/admin/tournaments/{id}/matches
export async function createMatch(tournamentId: string, input: MatchInput): Promise<Match> {
  const dto = await http.post<AdminMatchDto>(`/api/admin/tournaments/${tournamentId}/matches`, {
    match_number: input.matchNumber,
    scheduled_time: input.scheduledTime,
    join_window_opens_at: input.joinWindowOpensAt,
    join_window_closes_at: input.joinWindowClosesAt,
    room_id: input.roomId || undefined,
    room_password: input.roomPassword || undefined,
    access_info: input.accessInfo || undefined,
  });
  return mapAdminMatch(dto);
}

// PUT /api/admin/matches/{id}
export async function updateMatch(matchId: string, input: Partial<MatchInput>): Promise<Match> {
  const dto = await http.put<AdminMatchDto>(`/api/admin/matches/${matchId}`, {
    ...(input.scheduledTime !== undefined ? { scheduled_time: input.scheduledTime } : {}),
    ...(input.joinWindowOpensAt !== undefined ? { join_window_opens_at: input.joinWindowOpensAt } : {}),
    ...(input.joinWindowClosesAt !== undefined ? { join_window_closes_at: input.joinWindowClosesAt } : {}),
    ...(input.roomId !== undefined ? { room_id: input.roomId || null } : {}),
    ...(input.roomPassword !== undefined ? { room_password: input.roomPassword || null } : {}),
    ...(input.accessInfo !== undefined ? { access_info: input.accessInfo || null } : {}),
  });
  return mapAdminMatch(dto);
}

async function transition(matchId: string, action: string): Promise<Match> {
  const dto = await http.post<AdminMatchDto>(`/api/admin/matches/${matchId}/${action}`);
  return mapAdminMatch(dto);
}

export const startMatch = (matchId: string) => transition(matchId, "start");
export const endMatch = (matchId: string) => transition(matchId, "end");
export const cancelMatch = (matchId: string) => transition(matchId, "cancel");
