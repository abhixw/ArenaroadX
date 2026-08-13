import { http } from "@/api/client";
import { mapUser, type UserDto } from "@/lib/mappers";
import type { User } from "@/types";

// GET /api/auth/me
export async function getMe(): Promise<User> {
  const dto = await http.get<UserDto>("/api/auth/me");
  return mapUser(dto);
}

// POST /api/auth/login
export async function login(email: string, password: string): Promise<User> {
  const dto = await http.post<UserDto>("/api/auth/login", { email, password });
  return mapUser(dto);
}

// POST /api/auth/register
export async function register(name: string, email: string, password: string, phone: string): Promise<User> {
  const dto = await http.post<UserDto>("/api/auth/register", { name, email, password, phone });
  return mapUser(dto);
}

// POST /api/auth/logout
export async function logout(): Promise<void> {
  await http.post("/api/auth/logout");
}

// PUT /api/auth/me
export async function updateProfile(input: { name: string; phone?: string }): Promise<User> {
  const dto = await http.put<UserDto>("/api/auth/me", input);
  return mapUser(dto);
}
