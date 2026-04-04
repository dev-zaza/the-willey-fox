import { storage } from '@/lib/storage';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, apiClient } from './api';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionTier?: string;
  isVerified?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  mfaToken: string;
}

export interface SignupResponse {
  user: Pick<UserProfile, 'id' | 'email' | 'firstName' | 'lastName'>;
  message: string;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse | MfaRequiredResponse> {
    const { data } = await apiClient.post<LoginResponse | MfaRequiredResponse>('/auth/login', { email, password });
    if ('mfaRequired' in data && data.mfaRequired) {
      return data;
    }
    const loginData = data as LoginResponse;
    await storage.setItemAsync(ACCESS_TOKEN_KEY, loginData.accessToken);
    await storage.setItemAsync(REFRESH_TOKEN_KEY, loginData.refreshToken);
    return loginData;
  },

  async signup(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<SignupResponse> {
    const { data } = await apiClient.post<SignupResponse>('/auth/signup', {
      firstName,
      lastName,
      email,
      password,
    });
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    try {
      await apiClient.post('/auth/logout', { refreshToken });
    } finally {
      await storage.deleteItemAsync(ACCESS_TOKEN_KEY);
      await storage.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  },

  async getProfile(): Promise<UserProfile> {
    const { data } = await apiClient.get<UserProfile>('/users/me');
    return data;
  },
};
