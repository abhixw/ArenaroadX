import { http } from "@shared/api/client";
import { mapGame, type GameDto } from "@shared/lib/mappers";
import type { Game } from "@shared/types";

// GET /api/games
export async function getGames(): Promise<Game[]> {
  const dtos = await http.get<GameDto[]>("/api/games");
  return dtos.map(mapGame);
}

// GET /api/games/{game_id}
export async function getGame(gameId: string): Promise<Game | undefined> {
  if (!gameId) return undefined;
  const dto = await http.get<GameDto>(`/api/games/${gameId}`);
  return mapGame(dto);
}
