import { http, type Pagination } from "@/api/client";
import { mapAdminUser, type AdminUserDto } from "@/lib/adminMappers";
import type { User, UserStatus } from "@/types";

// GET /api/admin/users?search=...&page=...&page_size=...
export async function listUsers(
  search: string | undefined,
  page: number,
  pageSize: number,
): Promise<{ items: User[]; pagination: Pagination | null }> {
  const { data, pagination } = await http.getPage<AdminUserDto>("/api/admin/users", {
    search,
    page,
    page_size: pageSize,
  });
  return { items: data.map(mapAdminUser), pagination };
}

// PUT /api/admin/users/{id}/status
export async function updateUserStatus(userId: string, status: UserStatus): Promise<User> {
  const dto = await http.put<AdminUserDto>(`/api/admin/users/${userId}/status`, { status });
  return mapAdminUser(dto);
}

// POST /api/admin/users/{id}/reset-password -- no self-service "forgot password" flow exists
// (no email infrastructure), so an admin sets a new password directly and relays it to the
// player out-of-band, matching how this platform already operates manually.
export async function resetUserPassword(userId: string, newPassword: string): Promise<User> {
  const dto = await http.post<AdminUserDto>(`/api/admin/users/${userId}/reset-password`, {
    new_password: newPassword,
  });
  return mapAdminUser(dto);
}
