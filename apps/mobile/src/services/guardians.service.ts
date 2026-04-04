import { apiClient } from './api';

export interface GuardianMapping {
  id: string;
  qrCodeId: string;
  userId: string;
  status: 'pending' | 'active' | 'rejected' | 'removed';
  addedBy: string;
  createdAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  };
}

export const guardiansService = {
  acceptInvite: async (token: string): Promise<GuardianMapping> => {
    const res = await apiClient.post<GuardianMapping>('/guardians/invite/accept', { token });
    return res.data;
  },

  list: async (qrCodeId: string): Promise<GuardianMapping[]> => {
    const { data } = await apiClient.get<GuardianMapping[]>(`/qr-codes/${qrCodeId}/guardians`);
    return data;
  },

  inviteByEmail: async (qrCodeId: string, email: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>(`/qr-codes/${qrCodeId}/guardians/invite`, { email });
    return data;
  },

  reject: async (qrCodeId: string, userId: string): Promise<void> => {
    await apiClient.post(`/qr-codes/${qrCodeId}/guardians/${userId}/reject`);
  },

  remove: async (qrCodeId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/qr-codes/${qrCodeId}/guardians/${userId}`);
  },
};
