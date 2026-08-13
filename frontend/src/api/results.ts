import { http } from "@/api/client";
import { mapLeaderboardRow, type LeaderboardEntryDto, type LeaderboardHistoryEntryDto } from "@/lib/mappers";
import type { Tournament, TournamentResultRow } from "@/types";

// GET /api/tournaments/{id}/leaderboard (published results only)
export async function getLeaderboard(tournamentId: string): Promise<TournamentResultRow[]> {
  const dto = await http.get<{ tournament_id: string; entries: LeaderboardEntryDto[] }>(
    `/api/tournaments/${tournamentId}/leaderboard`,
  );
  return dto.entries.map(mapLeaderboardRow);
}

export interface RecentResult {
  tournamentId: string;
  tournamentName: string;
  imageUrl: string;
  rank: number;
  totalPlayers: number;
  score: number;
  publishedAt: string;
}

// GET /api/users/me/leaderboard-history -- enriched with each tournament's thumbnail/player
// count from the already-fetched tournaments list (the history endpoint itself only carries
// tournament_id/name/rank/score, so there's nothing to enrich with server-side without a
// bigger join change).
export async function getRecentResults(tournaments: Tournament[]): Promise<RecentResult[]> {
  const dtos = await http.get<LeaderboardHistoryEntryDto[]>("/api/users/me/leaderboard-history");
  const tournamentMap = new Map(tournaments.map((t) => [t.id, t]));
  return dtos.map((dto) => {
    const tournament = tournamentMap.get(String(dto.tournament_id));
    return {
      tournamentId: String(dto.tournament_id),
      tournamentName: dto.tournament_name,
      imageUrl: tournament?.imageUrl ?? "",
      rank: dto.rank,
      totalPlayers: tournament?.registeredPlayers ?? 0,
      score: dto.score,
      publishedAt: tournament?.startsAt ?? new Date().toISOString(),
    };
  });
}
