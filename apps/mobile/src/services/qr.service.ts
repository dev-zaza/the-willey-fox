import { apiClient } from './api';

export interface QrCode {
  id: string;
  uniqueCode: string;
  name: string;
  category: string;
  isLost: boolean;
  isOwner?: boolean;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
  themeId?: string | null;
  createdAt: string;
}

export interface CreateQrCodePayload {
  name: string;
  category: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
}

export const qrService = {
  list: async (): Promise<QrCode[]> => {
    const { data } = await apiClient.get<QrCode[]>('/qr-codes');
    return data;
  },

  get: async (id: string): Promise<QrCode> => {
    const { data } = await apiClient.get<QrCode>(`/qr-codes/${id}`);
    return data;
  },

  create: async (payload: CreateQrCodePayload): Promise<QrCode> => {
    const { data } = await apiClient.post<QrCode>('/qr-codes', payload);
    return data;
  },

  update: async (id: string, payload: Partial<CreateQrCodePayload & { isLost: boolean }>): Promise<QrCode> => {
    const { data } = await apiClient.patch<QrCode>(`/qr-codes/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/qr-codes/${id}`);
  },

  markLost: async (id: string): Promise<QrCode> => {
    const { data } = await apiClient.post<QrCode>(`/qr-codes/${id}/mark-lost`);
    return data;
  },

  markFound: async (id: string): Promise<QrCode> => {
    const { data } = await apiClient.post<QrCode>(`/qr-codes/${id}/mark-found`);
    return data;
  },
};
