import { apiClient } from './api';

export interface FlaggedSegment {
  h3: string;
  band: string;
  score: number;
  from: [number, number];
  to: [number, number];
}

export interface SuggestedWaypoint {
  avoidH3: string;
  h3: string;
  lat: number;
  lng: number;
  band: string;
}

export interface RouteSafetyResult {
  resolution: number;
  bbox: [number, number, number, number];
  cellsChecked: number;
  flaggedSegments: FlaggedSegment[];
  suggestedWaypoints: SuggestedWaypoint[];
}

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

export interface H3Tile {
  h3: string;
  score: number | null;
  band: string;
  color: string;
  incidentCount: number;
  coordinates: [number, number][][];
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

  getH3Tiles: async (bbox: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  }, resolution = 9, country?: string): Promise<H3Tile[]> => {
    const bboxParam = `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
    const params: Record<string, string | number> = { bbox: bboxParam, resolution };
    if (country) params.country = country;
    const { data } = await apiClient.get<{ type: string; features: Array<{
      type: string;
      geometry: { type: string; coordinates: [number, number][][] };
      properties: { h3: string; score: number | null; band: string; color: string; incidentCount: number };
    }> }>('/safety-engine/tiles', { params });
    return (data.features ?? []).map((f) => ({
      h3: f.properties.h3,
      score: f.properties.score,
      band: f.properties.band,
      color: f.properties.color,
      incidentCount: f.properties.incidentCount,
      coordinates: f.geometry.coordinates,
    }));
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

  getAreaSummary: async (params: {
    lat: number;
    lng: number;
    radius?: number;
    city?: string;
  }): Promise<{
    lat: number;
    lng: number;
    radiusMetres: number;
    cityName: string;
    score: number | null;
    rawPoliceScore: number | null;
    band: string | null;
    incidentCount: number;
    weightedPerKm2: number;
    crimeBreakdown: Array<{ type: string; count: number }>;
    dataMonth: string;
    scoreMethodology: string;
  }> => {
    const { data } = await apiClient.get('/safety-engine/area-summary', {
      params: {
        lat: params.lat,
        lng: params.lng,
        radius: params.radius ?? 5000,
        city: params.city,
      },
    });
    return data;
  },

  renderTravelGuide: async (city: string): Promise<{ available: boolean; html: string | null; city: string }> => {
    const { data } = await apiClient.post<{ available: boolean; html: string | null; city: string }>(
      '/safety-engine/travel-guide/render',
      { city },
    );
    return data;
  },

  routeSafetyCheck: async (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    resolution = 9,
  ): Promise<RouteSafetyResult> => {
    const lineString = {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      },
      properties: {},
    };
    const { data } = await apiClient.post<RouteSafetyResult>('/directions/route-safety-check', {
      lineString,
      resolution,
    });
    return data;
  },
};
