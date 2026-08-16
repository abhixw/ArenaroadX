import { http } from "@shared/api/client";
import { mapPrize, type MyPrizeDto } from "@shared/lib/mappers";
import type { Prize } from "@shared/types";

// GET /api/users/me/prizes
export async function getMyPrizes(userId: string): Promise<Prize[]> {
  const dtos = await http.get<MyPrizeDto[]>("/api/users/me/prizes");
  return dtos.map((dto) => mapPrize(dto, userId));
}
