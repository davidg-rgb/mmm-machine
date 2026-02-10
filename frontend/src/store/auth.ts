import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  workspace_id: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  checkTokenExpiry: () => void;
}

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (!parts[1]) return true;
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    if (!exp) return false;
    // Add 30 second buffer
    return Date.now() >= (exp - 30) * 1000;
  } catch {
    return true;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
      checkTokenExpiry: () => {
        const { accessToken, refreshToken } = get();
        if (!accessToken || !refreshToken) return;
        // If refresh token is expired, log out completely
        if (isTokenExpired(refreshToken)) {
          get().logout();
          return;
        }
        // If access token is expired but refresh is still valid,
        // keep authenticated - the interceptor will handle refresh
      },
    }),
    { name: "mixmodel-auth" },
  ),
);
