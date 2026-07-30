import { apiClient } from './api';

export interface FamilyMembership {
  familyId: string;
  role: string;
  familyName: string;
  ownerId: string;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}

export interface FamilyQr {
  id: string;
  name: string;
  category: string;
  uniqueCode: string;
  isLost: boolean;
}

export interface FamilyDetail {
  id: string;
  name: string;
  ownerId: string;
  members: FamilyMember[];
  qrCodes: FamilyQr[];
}

export const familiesService = {
  list: async (): Promise<FamilyMembership[]> => {
    const { data } = await apiClient.get<FamilyMembership[]>('/families');
    return data ?? [];
  },

  get: async (id: string): Promise<FamilyDetail> => {
    const { data } = await apiClient.get<FamilyDetail>(`/families/${id}`);
    return data;
  },

  create: async (name: string): Promise<{ id: string; name: string }> => {
    const { data } = await apiClient.post<{ id: string; name: string }>('/families', { name });
    return data;
  },

  addMember: async (familyId: string, payload: { userId?: string; email?: string }): Promise<void> => {
    await apiClient.post(`/families/${familyId}/members`, payload);
  },

  removeMember: async (familyId: string, targetUserId: string): Promise<void> => {
    await apiClient.delete(`/families/${familyId}/members/${targetUserId}`);
  },

  addQrCode: async (familyId: string, qrCodeId: string): Promise<void> => {
    await apiClient.post(`/families/${familyId}/qr-codes`, { qrCodeId });
  },

  removeQrCode: async (familyId: string, qrCodeId: string): Promise<void> => {
    await apiClient.delete(`/families/${familyId}/qr-codes/${qrCodeId}`);
  },

  delete: async (familyId: string): Promise<void> => {
    await apiClient.delete(`/families/${familyId}`);
  },
};
