import { SAFETY_SOURCES, SAFETY_GRANULARITIES, ROUTE_RATING_TAGS } from '../constants/enums';
import { Pin } from './pin.types';

export type SafetySource = (typeof SAFETY_SOURCES)[number];
export type SafetyGranularity = (typeof SAFETY_GRANULARITIES)[number];
export type RouteRatingTag = (typeof ROUTE_RATING_TAGS)[number];
export type SafetyGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type RouteLabel = 'safest' | 'fastest' | 'balanced';
export type SegmentColour = 'green' | 'amber' | 'red';

export interface SafetyZone {
  id: string;
  source: SafetySource;
  sourceRegion: string;
  sourceGranularity: SafetyGranularity;
  centerLat?: number;
  centerLng?: number;
  radiusMetres?: number;
  bboxMinLat?: number;
  bboxMinLng?: number;
  bboxMaxLat?: number;
  bboxMaxLng?: number;
  safetyScore: number;
  crimeData: Record<string, unknown>;
  periodStart: string;
  periodEnd: string;
  fetchedAt: string;
  expiresAt: string;
}

export interface RouteSegmentScore {
  polyline: string;
  safetyScore: number;
  colour: SegmentColour;
}

export interface RouteUserRating {
  average: number;
  count: number;
}

export interface RouteOption {
  id: string;
  label: RouteLabel;
  mapboxRouteId: string;
  polyline: string;
  safetyScore: number;
  safetyGrade: SafetyGrade;
  durationMinutes: number;
  distanceKm: number;
  affectedPins: Pin[];
  segmentScores: RouteSegmentScore[];
  warnings: string[];
  dataSource: string;
  userRating?: RouteUserRating;
}

export interface RouteRating {
  id: string;
  userId: string;
  mapboxRouteId?: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  overallRating: number;
  tags: RouteRatingTag[];
  comment?: string;
  travelTimeMinutes?: number;
  departedAt?: string;
  createdAt: string;
}
