import { http } from "@/api/client";
import { mapGame, type GameDto } from "@/lib/mappers";
import type { Game } from "@/types";

export interface GameInput {
  name: string;
  description?: string;
  imageUrl?: string;
  gameType?: string;
}

function toPayload(input: GameInput) {
  return {
    name: input.name,
    description: input.description || undefined,
    image_url: input.imageUrl || undefined,
    game_type: input.gameType || undefined,
  };
}

// GET /api/games (admin reuses the public list -- no admin-only fields on Game)
export async function listGames(): Promise<Game[]> {
  const dtos = await http.get<GameDto[]>("/api/games");
  return dtos.map(mapGame);
}

// POST /api/admin/games
export async function createGame(input: GameInput): Promise<Game> {
  const dto = await http.post<GameDto>("/api/admin/games", toPayload(input));
  return mapGame(dto);
}

// PUT /api/admin/games/{id}
export async function updateGame(
  id: string,
  input: Partial<GameInput> & { isActive?: boolean },
): Promise<Game> {
  const dto = await http.put<GameDto>(`/api/admin/games/${id}`, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    ...(input.imageUrl !== undefined ? { image_url: input.imageUrl || null } : {}),
    ...(input.gameType !== undefined ? { game_type: input.gameType || null } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
  });
  return mapGame(dto);
}

// DELETE /api/admin/games/{id}
export async function deleteGame(id: string): Promise<void> {
  await http.delete(`/api/admin/games/${id}`);
}
