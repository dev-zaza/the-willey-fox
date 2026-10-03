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
  customFields?: Record<string, unknown> | null;
}

export interface CreateQrCodePayload {
  name: string;
  category: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
}

export interface QrPublicLookup {
  id?: string;
  uniqueCode: string;
  status?: string;
  category?: string;
  name?: string;
  isLost?: boolean;
}

export interface ActivateQrPayload {
  code: string;
  name: string;
  category: string;
  ownerContactEmail?: string;
  ownerContactPhone?: string;
  rewardMessage?: string;
}

function extractCode(raw: string): string | null {
  const match = raw.match(/\/q\/([A-Z0-9-]+)/i);
  if (match) return match[1].toUpperCase();
  const trimmed = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return trimmed.length >= 6 ? trimmed : null;
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

  lookupPublic: async (code: string): Promise<QrPublicLookup> => {
    const { data } = await apiClient.get<QrPublicLookup>(`/public/q/${code}`);
    return data;
  },

  activate: async (payload: ActivateQrPayload): Promise<QrCode> => {
    const { data } = await apiClient.post<QrCode>('/public/qr/activate', payload);
    return data;
  },

  extractCode,
};
