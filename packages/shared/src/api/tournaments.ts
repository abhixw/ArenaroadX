import { http } from "@shared/api/client";
import {
  mapMatch,
  mapTournament,
  type GameDto,
  type MatchDto,
  type MyTournamentEntry,
  type TournamentDto,
} from "@shared/lib/mappers";
import type { Match, Tournament } from "@shared/types";

// The backend has no per-tournament image, only per-game -- fetch games alongside
// tournaments so mapTournament can fall back to the parent game's art. See mapTournament's
// docstring in lib/mappers.ts for why.
async function getGameImageMap(): Promise<Map<string, string | null>> {
  const games = await http.get<GameDto[]>("/api/games");
  return new Map(games.map((g) => [String(g.id), g.image_url]));
}

// GET /api/tournaments
export async function getTournaments(): Promise<Tournament[]> {
  const [dtos, gameImages] = await Promise.all([
    http.get<TournamentDto[]>("/api/tournaments"),
    getGameImageMap(),
  ]);
  return dtos.map((dto) => mapTournament(dto, gameImages.get(String(dto.game_id))));
}

// GET /api/tournaments/{id}
export async function getTournament(id: string): Promise<Tournament | undefined> {
  if (!id) return undefined;
  const dto = await http.get<TournamentDto>(`/api/tournaments/${id}`);
  const game = await http.get<GameDto>(`/api/games/${dto.game_id}`);
  return mapTournament(dto, game.image_url);
}

// GET /api/tournaments/{id}/matches (no room credentials -- see getMatchAccess)
export async function getMatches(tournamentId: string, gameUrl?: string | null): Promise<Match[]> {
  const dtos = await http.get<MatchDto[]>(`/api/tournaments/${tournamentId}/matches`);
  return dtos.map((dto) => mapMatch(dto, gameUrl));
}

export interface MatchAccess {
  roomId: string | null;
  roomPassword: string | null;
  accessInfo: string | null;
}

// GET /api/tournaments/{id}/matches/{matchId}/access -- confirmed participants only, once
// the join window opens. Throws (403/400) if the caller isn't eligible yet; callers should
// treat that as "no room details to show" rather than a hard failure.
export async function getMatchAccess(tournamentId: string, matchId: string): Promise<MatchAccess> {
  const dto = await http.get<{ room_id: string | null; room_password: string | null; access_info: string | null }>(
    `/api/tournaments/${tournamentId}/matches/${matchId}/access`,
  );
  return { roomId: dto.room_id, roomPassword: dto.room_password, accessInfo: dto.access_info };
}

export interface NextMatchInfo {
  tournament: Tournament;
  match: Match;
}

const NEXT_MATCH_ELIGIBLE_STATUSES: Tournament["status"][] = ["LIVE", "REGISTRATION_CLOSED", "READY"];

// No single backend endpoint answers "what's my next match" -- it's derived here by checking
// each confirmed, not-yet-finished tournament's match list. Bounded by how many tournaments
// one player is confirmed for at once, which is small in practice.
export async function findNextMatch(entries: MyTournamentEntry[]): Promise<NextMatchInfo | null> {
  const qualifying = entries.filter(
    (e) => e.registration.status === "CONFIRMED" && NEXT_MATCH_ELIGIBLE_STATUSES.includes(e.tournament.status),
  );

  const candidates = await Promise.all(
    qualifying.map(async (e) => {
      const matches = await getMatches(e.tournament.id, e.tournament.gameUrl);
      const upcoming = matches
        .filter((m) => m.status === "SCHEDULED" || m.status === "LIVE")
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
      return upcoming ? { tournament: e.tournament, match: upcoming } : null;
    }),
  );

  return (
    candidates
      .filter((c): c is NextMatchInfo => c !== null)
      .sort((a, b) => new Date(a.match.scheduledAt).getTime() - new Date(b.match.scheduledAt).getTime())[0] ?? null
  );
}
