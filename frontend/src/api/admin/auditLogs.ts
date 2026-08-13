import { http } from "@/api/client";
import { mapAuditLog, type AuditLogDto } from "@/lib/adminMappers";
import type { AuditLogEntry } from "@/types/admin";

// GET /api/admin/audit-logs
export async function listAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  const dtos = await http.get<AuditLogDto[]>("/api/admin/audit-logs", { limit });
  return dtos.map(mapAuditLog);
}
