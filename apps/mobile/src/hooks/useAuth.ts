import axios from 'axios';
import { getFriendlyErrorMessage } from '@safetag/shared';
import { storage } from '@/lib/storage';
import { isServiceUnavailable } from '@/lib/api-error';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/services/api';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores';

export interface AuthError {
  message: string;
  isServiceUnavailable: boolean;
}

function extractAuthError(error: unknown): AuthError {
  const isUnavailable = isServiceUnavailable(error);
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return {
        message: isUnavailable
          ? "We're having trouble connecting. Please check your internet connection and try again."
          : "Something went wrong. Please try again later.",
        isServiceUnavailable: isUnavailable,
      };
    }
    const raw = (error.response.data as { message?: string | string[] })?.message;
    return {
      message: getFriendlyErrorMessage(raw, 'Something went wrong. Please try again.'),
      isServiceUnavailable: isUnavailable,
    };
  }
  if (error instanceof Error) {
    return {
      message: isUnavailable
        ? "We're having trouble connecting. Please try again."
        : getFriendlyErrorMessage(error.message, 'Something went wrong. Please try again.'),
      isServiceUnavailable: isUnavailable,
    };
  }
  return {
    message: "Something went wrong. Please try again.",
    isServiceUnavailable: false,
  };
}

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setTokens, setLoading, setMfaToken, clearAuth } =
    useAuthStore();

  const login = async (email: string, password: string): Promise<AuthError | null> => {
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      // 2FA required — store mfaToken, do not authenticate yet
      if ('mfaRequired' in data && data.mfaRequired) {
        setMfaToken(data.mfaToken as string);
        return null;
      }
      // Normal login — narrowed to LoginResponse after MFA guard
      const loginData = data as import('@/services/auth.service').LoginResponse;
      setTokens(loginData.accessToken);
      setUser(loginData.user);
      return null;
    } catch (err) {
      return extractAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<AuthError | string | null> => {
    setLoading(true);
    try {
      const data = await authService.signup(firstName, lastName, email, password);
      return data.message ?? 'VERIFY_EMAIL';
    } catch (err) {
      return extractAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const refreshToken = await storage.getItemAsync(REFRESH_TOKEN_KEY);
      await authService.logout(refreshToken ?? '');
    } finally {
      await storage.deleteItemAsync(ACCESS_TOKEN_KEY);
      await storage.deleteItemAsync(REFRESH_TOKEN_KEY);
      clearAuth();
    }
  };

  return { user, isAuthenticated, isLoading, login, signup, logout, setUser, setMfaToken };
}
