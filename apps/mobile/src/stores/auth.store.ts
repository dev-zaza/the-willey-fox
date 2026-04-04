import { create } from 'zustand';
import type { UserProfile } from '@/services/auth.service';
export type { UserProfile };

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaToken: string | null;
  setUser: (user: UserProfile) => void;
  setTokens: (accessToken: string) => void;
  setLoading: (loading: boolean) => void;
  setMfaToken: (token: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  mfaToken: null,

  setUser: (user) => set({ user, isAuthenticated: true }),

  setTokens: (accessToken) => set({ accessToken }),

  setLoading: (isLoading) => set({ isLoading }),

  setMfaToken: (mfaToken) => set({ mfaToken }),

  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      mfaToken: null,
    }),
}));
