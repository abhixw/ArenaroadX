import { ApiError, http } from "@/api/client";
import {
  mapMyTournament,
  mapRegistration,
  type GameDto,
  type MyTournamentDto,
  type MyTournamentEntry,
  type RegistrationDto,
} from "@/lib/mappers";
import type { Registration } from "@/types";

async function getGameImageMap(): Promise<Map<string, string | null>> {
  const games = await http.get<GameDto[]>("/api/games");
  return new Map(games.map((g) => [String(g.id), g.image_url]));
}

// GET /api/my-tournaments -- already pre-joined with tournament data by the backend.
export async function getMyTournaments(): Promise<MyTournamentEntry[]> {
  const [dtos, gameImages] = await Promise.all([
    http.get<MyTournamentDto[]>("/api/my-tournaments"),
    getGameImageMap(),
  ]);
  return dtos
    .map((dto) => mapMyTournament(dto, gameImages.get(String(dto.tournament.game_id))))
    .sort((a, b) => new Date(b.tournament.startsAt).getTime() - new Date(a.tournament.startsAt).getTime());
}

// GET /api/my-tournaments/{tournamentId} -- 404 just means "not registered yet".
export async function getRegistrationForTournament(tournamentId: string): Promise<Registration | undefined> {
  try {
    const dto = await http.get<MyTournamentDto>(`/api/my-tournaments/${tournamentId}`);
    return mapMyTournament(dto).registration;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

// POST /api/tournaments/{id}/register -- no body; the backend registers using whichever
// game account is already saved for this tournament's game (see api/gameAccounts.ts's
// upsertGameAccountForTournament, which the registration flow calls first).
export async function registerForTournament(tournamentId: string): Promise<Registration> {
  const dto = await http.post<RegistrationDto>(`/api/tournaments/${tournamentId}/register`);
  return mapRegistration(dto);
}
