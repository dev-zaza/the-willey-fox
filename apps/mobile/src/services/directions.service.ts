import { apiClient } from './api';

export interface SafetyZone {
  id: string;
  safetyScore: number;
  source: string;
  sourceRegion: string | null;
  colour: string;
  centerLat: string | null;
  centerLng: string | null;
  radiusMetres: number | null;
}

export interface RouteResult {
  id: string;
  label: 'safest' | 'fastest' | 'balanced';
  polyline: string; // encoded Google polyline
  safetyScore: number | null;
  safetyGrade: string | null;
  durationMinutes: number;
  distanceKm: number;
  warnings: string[];
  affectedPins: Array<{ id: string; type: string; title: string; lat: string; lng: string }>;
  userRating: { average: number; count: number } | null;
  dataSource: string | null;
}

export const directionsService = {
  getSafetyOverlay: async (bbox: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  }): Promise<SafetyZone[]> => {
    const { data } = await apiClient.get<{ zones: SafetyZone[] }>('/directions/safety-overlay', {
      params: {
        minLat: bbox.minLat,
        minLng: bbox.minLng,
        maxLat: bbox.maxLat,
        maxLng: bbox.maxLng,
      },
    });
    return data.zones ?? [];
  },

  geocode: async (
    query: string,
    proximity?: { lat: number; lng: number },
  ): Promise<Array<{ id: string; name: string; fullName: string; lat: number; lng: number }>> => {
    const params: Record<string, string> = { q: query };
    if (proximity) { params.lat = String(proximity.lat); params.lng = String(proximity.lng); }
    const { data } = await apiClient.get<{ results: Array<{ id: string; name: string; fullName: string; lat: number; lng: number }> }>('/directions/geocode', { params });
    return data.results ?? [];
  },

  getRoute: async (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    prioritize: 'safety' | 'speed' | 'balanced' = 'balanced',
  ): Promise<RouteResult[]> => {
    const { data } = await apiClient.post<{ routes: RouteResult[] }>('/directions/route', {
      origin,
      destination,
      preferences: { prioritize },
    });
    return data.routes ?? [];
  },
};
