import { apiClient } from './api';

export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}

export const usersService = {
  search: async (query: string): Promise<UserSearchResult[]> => {
    if (!query || query.trim().length < 2) return [];
    const { data } = await apiClient.get<UserSearchResult[]>(
      `/users/search?q=${encodeURIComponent(query.trim())}`,
    );
    return data;
  },

  updateLocation: async (lat: number, lng: number): Promise<void> => {
    await apiClient.post('/users/me/location', { lat, lng });
  },

  updateProfile: async (payload: { firstName?: string; lastName?: string; phone?: string }): Promise<void> => {
    await apiClient.put('/users/me', payload);
  },

  sendPhoneOtp: async (): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>('/users/me/phone/send-otp');
    return data;
  },

  verifyPhoneOtp: async (code: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>('/users/me/phone/verify', { code });
    return data;
  },
};
