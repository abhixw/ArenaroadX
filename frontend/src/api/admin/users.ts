import { http } from "@/api/client";
import { mapAdminUser, type AdminUserDto } from "@/lib/adminMappers";
import type { User, UserStatus } from "@/types";

// GET /api/admin/users?search=...
export async function listUsers(search?: string): Promise<User[]> {
  const dtos = await http.get<AdminUserDto[]>("/api/admin/users", search ? { search } : undefined);
  return dtos.map(mapAdminUser);
}

// PUT /api/admin/users/{id}/status
export async function updateUserStatus(userId: string, status: UserStatus): Promise<User> {
  const dto = await http.put<AdminUserDto>(`/api/admin/users/${userId}/status`, { status });
  return mapAdminUser(dto);
}
