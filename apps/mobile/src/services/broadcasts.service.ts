import { apiClient } from './api';

export interface BroadcastListItem {
  id: string;
  qrCodeId: string;
  qrUniqueCode: string;
  category: string;
  name?: string | null;
  photoUrl?: string | null;
  lastSeenLocation?: string | null;
  lastSeenNotes?: string | null;
  broadcastApprovedAt: string;
  broadcastExpiresAt: string;
}

export interface BroadcastDetail extends BroadcastListItem {
  description?: string | null;
  customFields?: Record<string, unknown> | null;
  lastSeenLat?: string | null;
  lastSeenLng?: string | null;
}

export const TOS_VERSION_MOBILE = 'broadcast-v1-2026-04-22';

export const broadcastsService = {
  listPublic: async (page = 1, pageSize = 20): Promise<{ items: BroadcastListItem[] }> => {
    const { data } = await apiClient.get(`/public/broadcasts?page=${page}&pageSize=${pageSize}`);
    return data;
  },

  getPublic: async (id: string): Promise<BroadcastDetail> => {
    const { data } = await apiClient.get<BroadcastDetail>(`/public/broadcasts/${id}`);
    return data;
  },

  enable: async (reportId: string, tosVersion = TOS_VERSION_MOBILE) => {
    const { data } = await apiClient.post(`/reports/${reportId}/broadcast`, { tosVersion });
    return data;
  },

  disable: async (reportId: string, reason?: string) => {
    const { data } = await apiClient.delete(`/reports/${reportId}/broadcast`, {
      data: reason ? { reason } : {},
    });
    return data;
  },

  extend: async (reportId: string) => {
    const { data } = await apiClient.post(`/reports/${reportId}/broadcast/extend`);
    return data;
  },

  messageGuardian: async (broadcastId: string): Promise<{ conversationId: string }> => {
    const { data } = await apiClient.post(`/public/broadcasts/${broadcastId}/message`);
    return data;
  },
};
