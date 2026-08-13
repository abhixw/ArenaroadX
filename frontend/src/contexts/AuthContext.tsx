import { createContext, useEffect, useState, type ReactNode } from "react";
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  updateProfile as apiUpdateProfile,
} from "@/api/auth";
import { registerUnauthorizedHandler } from "@/api/client";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, phone: string) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (input: { name: string; phone?: string }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No session cookie (or an expired one) is the normal logged-out state, not an error.
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => setUser(null));
  }, []);

  async function login(email: string, password: string) {
    const loggedIn = await apiLogin(email, password);
    setUser(loggedIn);
    return loggedIn;
  }

  async function register(name: string, email: string, password: string, phone: string) {
    const registered = await apiRegister(name, email, password, phone);
    setUser(registered);
    return registered;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  async function updateProfile(input: { name: string; phone?: string }) {
    const updated = await apiUpdateProfile(input);
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
