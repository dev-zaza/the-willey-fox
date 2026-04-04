import { apiClient } from './api';

export interface Pin {
  id: string;
  title: string;
  description: string;
  type: string;
  lat: string;
  lng: string;
  status: string;
  upvotes: number;
  downvotes: number;
  expiresAt?: string;
  createdAt: string;
}

export interface CreatePinPayload {
  title: string;
  description?: string;
  type: string;
  lat: number;
  lng: number;
  expiresAt?: string;
}

export const pinsService = {
  list: async (params: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  }): Promise<Pin[]> => {
    const { data } = await apiClient.get<Pin[]>('/pins', { params });
    return data;
  },

  get: async (id: string): Promise<Pin> => {
    const { data } = await apiClient.get<Pin>(`/pins/${id}`);
    return data;
  },

  create: async (payload: CreatePinPayload): Promise<Pin> => {
    const { data } = await apiClient.post<Pin>('/pins', payload);
    return data;
  },

  vote: async (id: string, vote: 'up' | 'down'): Promise<void> => {
    await apiClient.post(`/pins/${id}/vote`, { isUpvote: vote === 'up' });
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/pins/${id}`);
  },
};
