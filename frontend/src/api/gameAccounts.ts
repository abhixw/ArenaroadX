import { http } from "@shared/api/client";
import { mapGameAccount, type GameAccountDto } from "@shared/lib/mappers";
import type { GameAccount } from "@shared/types";

// GET /api/my-game-accounts
export async function getMyGameAccounts(): Promise<GameAccount[]> {
  const dtos = await http.get<GameAccountDto[]>("/api/my-game-accounts");
  return dtos.map(mapGameAccount);
}

// POST /api/my-game-accounts/{gameId} -- standalone upsert for the Game Accounts management
// screen (not tied to a specific tournament's registration flow).
export async function upsertGameAccount(input: {
  gameId: string;
  gameUid: string;
  gameUsername: string;
}): Promise<GameAccount> {
  const dto = await http.post<GameAccountDto>(`/api/my-game-accounts/${input.gameId}`, {
    game_uid: input.gameUid,
    game_username: input.gameUsername,
  });
  return mapGameAccount(dto);
}

// POST /api/tournaments/{id}/game-account -- used from the registration flow, where the
// account is being confirmed/created in the context of one specific tournament.
export async function upsertGameAccountForTournament(
  tournamentId: string,
  input: { gameUid: string; gameUsername: string },
): Promise<GameAccount> {
  const dto = await http.post<GameAccountDto>(`/api/tournaments/${tournamentId}/game-account`, {
    game_uid: input.gameUid,
    game_username: input.gameUsername,
  });
  return mapGameAccount(dto);
}
