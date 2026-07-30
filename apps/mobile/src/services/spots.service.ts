import { apiClient } from './api';

export interface Spot {
  id: string;
  userId: string | null;
  locationName: string;
  lat: number;
  lng: number;
  instagramUrl: string | null;
  imageUrl: string | null;
  caption: string | null;
  safetyScore: string | null;
  safetyBand: string | null;
  createdAt: string;
}

export const spotsService = {
  listNearby: async (lat: number, lng: number, radius = 10000): Promise<Spot[]> => {
    const { data } = await apiClient.get<Spot[]>('/spots', {
      params: { lat, lng, radius },
    });
    return data ?? [];
  },

  create: async (input: {
    locationName: string;
    lat: number;
    lng: number;
    instagramUrl?: string;
    imageUrl?: string;
    caption?: string;
  }): Promise<Spot> => {
    const { data } = await apiClient.post<Spot>('/spots', input);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/spots/${id}`);
  },
};
