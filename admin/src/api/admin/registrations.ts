import { http } from "@shared/api/client";
import { mapParticipant, mapPlayerHistory, type ParticipantDto, type PlayerHistoryDto } from "@/lib/adminMappers";
import type { Participant, PlayerHistory } from "@/types/admin";

// GET /api/admin/tournaments/{id}/participants (confirmed participants)
export async function listParticipants(tournamentId: string): Promise<Participant[]> {
  const dtos = await http.get<ParticipantDto[]>(`/api/admin/tournaments/${tournamentId}/participants`);
  return dtos.map(mapParticipant);
}

// POST /api/admin/registrations/{id}/disqualify
export async function disqualifyRegistration(registrationId: string, reason: string): Promise<void> {
  await http.post(`/api/admin/registrations/${registrationId}/disqualify`, { reason });
}

// GET /api/admin/players/{userId}
export async function getPlayerHistory(userId: string): Promise<PlayerHistory> {
  const dto = await http.get<PlayerHistoryDto>(`/api/admin/players/${userId}`);
  return mapPlayerHistory(dto);
}
