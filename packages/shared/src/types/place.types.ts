import type { PLACE_TYPES } from '../constants/enums';

export type PlaceType = (typeof PLACE_TYPES)[number];

export interface Place {
  id: string;
  mapboxPoiId?: string | null;
  name: string;
  category: PlaceType;
  address?: string | null;
  lat: string;
  lng: string;
  overallRating?: string | null;
  reviewCount: number;
  isUserCreated: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceReview {
  id: string;
  placeId: string;
  userId: string;
  overallRating: number;
  safetyRating?: number | null;
  cleanlinessRating?: number | null;
  valueRating?: number | null;
  serviceRating?: number | null;
  comment?: string | null;
  flagCount: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewFlag {
  id: string;
  reviewId: string;
  userId: string;
  reason: string;
  createdAt: string;
}
