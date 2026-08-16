import { createContext, useEffect, useState, type ReactNode } from "react";
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  updateProfile as apiUpdateProfile,
} from "@shared/api/auth";
import { registerForbiddenHandler, registerUnauthorizedHandler } from "@shared/api/client";
import type { User } from "@shared/types";

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
    // A 403 means this tab's cached identity no longer matches the browser's actual session
    // cookie (most commonly: a different account logged in from another tab). Re-fetching
    // resyncs `user` to whoever is really logged in now, so role-gated layouts like
    // AdminLayout correctly redirect instead of continuing to render with stale state.
    registerForbiddenHandler(() => {
      getMe()
        .then(setUser)
        .catch(() => setUser(null));
    });
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
