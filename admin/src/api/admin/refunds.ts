import { http } from "@shared/api/client";
import { mapRefund, type RefundDto } from "@/lib/adminMappers";
import type { Refund } from "@/types/admin";

// GET /api/admin/tournaments/{id}/refunds
export async function listRefunds(tournamentId: string): Promise<Refund[]> {
  const dtos = await http.get<RefundDto[]>(`/api/admin/tournaments/${tournamentId}/refunds`);
  return dtos.map(mapRefund);
}

// POST /api/admin/refunds/{id}/process
export async function processRefund(refundId: string, providerReference: string): Promise<Refund> {
  const dto = await http.post<RefundDto>(`/api/admin/refunds/${refundId}/process`, {
    provider_reference: providerReference,
  });
  return mapRefund(dto);
}
