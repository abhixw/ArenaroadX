import { http } from "@shared/api/client";
import { mapTournament, type TournamentDto } from "@shared/lib/mappers";
import type { Tournament } from "@shared/types";

export interface TournamentInput {
  gameId: string;
  name: string;
  description?: string;
  entryFee: number;
  prizePool: number;
  firstPrize?: number;
  secondPrize?: number;
  maxPlayers: number;
  startTime: string; // ISO, must be tz-aware
  registrationDeadline: string; // ISO, must be before startTime
  gameUrl?: string;
  rules?: string;
  instructions?: string;
}

function toCreatePayload(input: TournamentInput) {
  return {
    game_id: input.gameId,
    name: input.name,
    description: input.description || undefined,
    entry_fee: input.entryFee,
    prize_pool: input.prizePool,
    first_prize: input.firstPrize,
    second_prize: input.secondPrize,
    max_players: input.maxPlayers,
    start_time: input.startTime,
    registration_deadline: input.registrationDeadline,
    game_url: input.gameUrl || undefined,
    rules: input.rules || undefined,
    instructions: input.instructions || undefined,
  };
}

// GET /api/tournaments -- shared with the player app; admin also sees DRAFT tournaments since
// the backend doesn't filter the public list by status.
export async function listTournaments(): Promise<Tournament[]> {
  const dtos = await http.get<TournamentDto[]>("/api/tournaments");
  const games = await http.get<{ id: string; image_url: string | null }[]>("/api/games");
  const imageByGame = new Map(games.map((g) => [String(g.id), g.image_url]));
  return dtos.map((dto) => mapTournament(dto, imageByGame.get(String(dto.game_id))));
}

// POST /api/admin/tournaments
export async function createTournament(input: TournamentInput): Promise<Tournament> {
  const dto = await http.post<TournamentDto>("/api/admin/tournaments", toCreatePayload(input));
  return mapTournament(dto);
}

// PUT /api/admin/tournaments/{id}
export async function updateTournament(id: string, input: Partial<TournamentInput>): Promise<Tournament> {
  const dto = await http.put<TournamentDto>(`/api/admin/tournaments/${id}`, {
    ...(input.gameId !== undefined ? { game_id: input.gameId } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    ...(input.entryFee !== undefined ? { entry_fee: input.entryFee } : {}),
    ...(input.prizePool !== undefined ? { prize_pool: input.prizePool } : {}),
    ...(input.firstPrize !== undefined ? { first_prize: input.firstPrize } : {}),
    ...(input.secondPrize !== undefined ? { second_prize: input.secondPrize } : {}),
    ...(input.maxPlayers !== undefined ? { max_players: input.maxPlayers } : {}),
    ...(input.startTime !== undefined ? { start_time: input.startTime } : {}),
    ...(input.registrationDeadline !== undefined ? { registration_deadline: input.registrationDeadline } : {}),
    ...(input.gameUrl !== undefined ? { game_url: input.gameUrl || null } : {}),
    ...(input.rules !== undefined ? { rules: input.rules || null } : {}),
    ...(input.instructions !== undefined ? { instructions: input.instructions || null } : {}),
  });
  return mapTournament(dto);
}

async function transition(id: string, action: string): Promise<Tournament> {
  const dto = await http.post<TournamentDto>(`/api/admin/tournaments/${id}/${action}`);
  return mapTournament(dto);
}

export const openRegistration = (id: string) => transition(id, "open-registration");
export const closeRegistration = (id: string) => transition(id, "close-registration");
export const markReady = (id: string) => transition(id, "mark-ready");
export const startTournament = (id: string) => transition(id, "start");
export const endTournament = (id: string) => transition(id, "end");

// No dedicated "complete" endpoint exists -- RESULTS_PUBLISHED -> COMPLETED is only reachable
// via the generic PUT's `status` field (TournamentUpdate.status), same mechanism the backend
// uses for any status transition beyond the named lifecycle actions.
export async function markCompleted(id: string): Promise<Tournament> {
  const dto = await http.put<TournamentDto>(`/api/admin/tournaments/${id}`, { status: "COMPLETED" });
  return mapTournament(dto);
}

// POST /api/admin/tournaments/{id}/cancel
export async function cancelTournament(id: string, reason: string): Promise<Tournament> {
  const dto = await http.post<TournamentDto>(`/api/admin/tournaments/${id}/cancel`, { reason });
  return mapTournament(dto);
}
