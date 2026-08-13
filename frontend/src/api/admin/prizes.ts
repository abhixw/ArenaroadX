import { http } from "@/api/client";
import { mapAdminPrize, type AdminPrizeDto } from "@/lib/adminMappers";
import type { Prize } from "@/types";

// GET /api/tournaments/{id}/prizes
export async function listPrizes(tournamentId: string, tournamentName: string): Promise<Prize[]> {
  const dtos = await http.get<AdminPrizeDto[]>(`/api/tournaments/${tournamentId}/prizes`);
  return dtos.map((dto) => mapAdminPrize(dto, tournamentName));
}

// POST /api/admin/tournaments/{id}/prizes -- only once results are published
export async function createPrize(
  tournamentId: string,
  tournamentName: string,
  input: { userId: string; rank: number; amount: number },
): Promise<Prize> {
  const dto = await http.post<AdminPrizeDto>(`/api/admin/tournaments/${tournamentId}/prizes`, {
    user_id: input.userId,
    rank: input.rank,
    amount: input.amount,
  });
  return mapAdminPrize(dto, tournamentName);
}

// PUT /api/admin/prizes/{id}
export async function updatePrize(
  prizeId: string,
  tournamentName: string,
  input: { rank?: number; amount?: number },
): Promise<Prize> {
  const dto = await http.put<AdminPrizeDto>(`/api/admin/prizes/${prizeId}`, {
    ...(input.rank !== undefined ? { rank: input.rank } : {}),
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
  });
  return mapAdminPrize(dto, tournamentName);
}

// POST /api/admin/prizes/{id}/mark-paid
export async function markPrizePaid(prizeId: string, tournamentName: string): Promise<Prize> {
  const dto = await http.post<AdminPrizeDto>(`/api/admin/prizes/${prizeId}/mark-paid`);
  return mapAdminPrize(dto, tournamentName);
}
