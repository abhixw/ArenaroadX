import { http, type Pagination } from "@shared/api/client";
import { mapAdminUser, type AdminUserDto } from "@/lib/adminMappers";
import type { User, UserStatus } from "@shared/types";

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

// POST /api/admin/users/{id}/reset-password -- lets an admin set a new password directly and
// relay it to the player out-of-band, for cases where the player can't complete the
// self-service forgot-password email flow themselves.
export async function resetUserPassword(userId: string, newPassword: string): Promise<User> {
  const dto = await http.post<AdminUserDto>(`/api/admin/users/${userId}/reset-password`, {
    new_password: newPassword,
  });
  return mapAdminUser(dto);
}
