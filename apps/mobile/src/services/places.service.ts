import { apiClient } from './api';

export type PlaceCategory =
  | 'hotel'
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'attraction'
  | 'park'
  | 'transport_hub'
  | 'shopping'
  | 'other';

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  address?: string;
  lat: string;
  lng: string;
  overallRating?: string;
  reviewCount: number;
  isUserCreated: boolean;
  createdAt: string;
}

export interface PlaceReview {
  id: string;
  placeId: string;
  userId: string;
  overallRating: number;
  safetyRating?: number;
  cleanlinessRating?: number;
  valueRating?: number;
  serviceRating?: number;
  comment?: string;
  createdAt: string;
}

export interface PlaceWithReviews extends Place {
  reviews: PlaceReview[];
}

export interface SearchPlacesParams {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  category?: PlaceCategory;
}

export interface CreatePlacePayload {
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  address?: string;
}

export interface CreateReviewPayload {
  overallRating: number;
  safetyRating?: number;
  cleanlinessRating?: number;
  valueRating?: number;
  serviceRating?: number;
  comment?: string;
}

export const placesService = {
  search: async (params: SearchPlacesParams): Promise<Place[]> => {
    const { data } = await apiClient.get<Place[]>('/places', { params });
    return data;
  },

  get: async (id: string): Promise<PlaceWithReviews> => {
    const { data } = await apiClient.get<PlaceWithReviews>(`/places/${id}`);
    return data;
  },

  create: async (payload: CreatePlacePayload): Promise<Place> => {
    const { data } = await apiClient.post<Place>('/places', payload);
    return data;
  },

  createReview: async (placeId: string, payload: CreateReviewPayload): Promise<PlaceReview> => {
    const { data } = await apiClient.post<PlaceReview>(`/places/${placeId}/reviews`, payload);
    return data;
  },

  flagReview: async (placeId: string, reviewId: string, reason: string): Promise<void> => {
    await apiClient.post(`/places/${placeId}/reviews/${reviewId}/flag`, { reason });
  },
};
