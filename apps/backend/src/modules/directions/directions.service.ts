import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { and, eq, gt, or, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { pins, routeRatings } from '../../database/schema';
import { SafetyEngineService } from '../safety-engine/safety-engine.service';
import { ZoneScorer } from '../safety-engine/scoring/zone-scorer';
import { RouteRequestDto } from './dto/route-request.dto';
import { SafetyOverlayDto } from './dto/safety-overlay.dto';
import { avg, count, sql } from 'drizzle-orm';

const MAPBOX_DIRECTIONS_BASE = 'https://api.mapbox.com/directions/v5/mapbox';
const PIN_ROUTE_BUFFER_DEG = 0.002; // ~200m buffer for community pins near route

@Injectable()
export class DirectionsService {
  private readonly logger = new Logger(DirectionsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly safetyEngineService: SafetyEngineService,
    private readonly zoneScorer: ZoneScorer,
  ) {}

  async getRoutes(dto: RouteRequestDto) {
    const mapboxToken = this.configService.getOrThrow<string>('MAPBOX_ACCESS_TOKEN');

    const { origin, destination } = dto;
    const profile = 'driving'; // driving profile for routes

    // Fetch routes from Mapbox (up to 3 alternatives)
    const url = `${MAPBOX_DIRECTIONS_BASE}/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=true&geometries=polyline&steps=false&access_token=${mapboxToken}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Mapbox API error ${response.status}: ${body}`);
      throw new BadRequestException('Failed to fetch routes from Mapbox');
    }

    const mapboxData = await response.json() as MapboxDirectionsResponse;

    if (!mapboxData.routes || mapboxData.routes.length === 0) {
      throw new BadRequestException('No routes found between the given coordinates');
    }

    // Score each route
    const scoredRoutes = await Promise.all(
      mapboxData.routes.slice(0, 3).map((route, idx) =>
        this.scoreRoute(route, idx, dto),
      ),
    );

    // Sort by preference
    const prioritize = dto.preferences?.prioritize ?? 'balanced';
    const sorted = this.sortRoutes(scoredRoutes, prioritize);

    // Assign labels
    const labeled = sorted.map((r, idx) => ({
      ...r,
      label: idx === 0
        ? (prioritize === 'safety' ? 'safest' : prioritize === 'speed' ? 'fastest' : 'balanced')
        : idx === 1 ? (prioritize === 'safety' ? 'fastest' : 'safest')
        : 'balanced',
    }));

    return { routes: labeled };
  }

  async getSafetyScoreForPoint(lat: number, lng: number) {
    const result = await this.safetyEngineService.getSafetyScore(lat, lng);

    return {
      lat,
      lng,
      ...result,
      colour: result.score != null ? this.zoneScorer.toColour(result.score) : null,
      grade: result.score != null ? this.zoneScorer.toGrade(result.score) : null,
    };
  }

  async geocode(query: string, proximityLat?: number, proximityLng?: number) {
    const mapboxToken = this.configService.getOrThrow<string>('MAPBOX_ACCESS_TOKEN');
    const encoded = encodeURIComponent(query);
    const proximity = proximityLat != null && proximityLng != null
      ? `&proximity=${proximityLng},${proximityLat}`
      : '';
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${mapboxToken}&limit=6&types=place,address,poi${proximity}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new BadRequestException('Geocoding request failed');

    const data = await response.json() as MapboxGeocodeResponse;
    return {
      results: (data.features ?? []).map(f => ({
        id: f.id,
        name: f.text,
        fullName: f.place_name,
        lat: f.center[1],
        lng: f.center[0],
      })),
    };
  }

  async getSafetyOverlay(dto: SafetyOverlayDto) {
    const zones = await this.safetyEngineService.getZonesInBbox(
      dto.minLat,
      dto.minLng,
      dto.maxLat,
      dto.maxLng,
    );

    return {
      zones: zones.map(z => ({
        ...z,
        safetyScore: Number(z.safetyScore),
        colour: this.zoneScorer.toColour(Number(z.safetyScore)),
      })),
    };
  }

  // ------- Private helpers -------

  private async scoreRoute(route: MapboxRoute, index: number, dto: RouteRequestDto) {
    const polyline = route.geometry;
    const durationMinutes = Math.round(route.duration / 60);
    const distanceKm = Math.round(route.distance / 100) / 10;

    // Score based on route midpoint (simplified — ideally sample multiple points)
    const midLat = (dto.origin.lat + dto.destination.lat) / 2;
    const midLng = (dto.origin.lng + dto.destination.lng) / 2;

    const safetyResult = await this.safetyEngineService.getSafetyScore(midLat, midLng);
    const safetyScore = safetyResult.score;

    // Get community pins near the route bounding box
    const affectedPins = await this.getPinsNearRoute(
      Math.min(dto.origin.lat, dto.destination.lat),
      Math.min(dto.origin.lng, dto.destination.lng),
      Math.max(dto.origin.lat, dto.destination.lat),
      Math.max(dto.origin.lng, dto.destination.lng),
    );

    // Get user route ratings for this origin/destination area
    const userRating = await this.getRouteUserRating(dto.origin.lat, dto.origin.lng, dto.destination.lat, dto.destination.lng);

    // Apply user rating penalty to safety score
    let adjustedScore = safetyScore;
    if (adjustedScore != null && userRating && userRating.average < 3.0) {
      const penalty = userRating.average < 2.0 ? 15 : userRating.average < 2.5 ? 10 : 5;
      adjustedScore = Math.max(0, adjustedScore - penalty);
    }

    // Safety Mode: extra penalty for harassment/pickpocket/unsafe_area pins
    const safetyMode = dto.preferences?.safetyMode ?? false;
    if (safetyMode && adjustedScore != null && affectedPins.length > 0) {
      const vulnerabilityPinTypes = ['harassment', 'pickpocket', 'unsafe_area'];
      const vulnerabilityPinCount = affectedPins.filter(
        (p: any) => vulnerabilityPinTypes.includes(p.type),
      ).length;
      if (vulnerabilityPinCount > 0) {
        const safetyModePenalty = vulnerabilityPinCount * 10;
        adjustedScore = Math.max(0, adjustedScore - safetyModePenalty);
      }
    }

    const warnings: string[] = [];
    if (affectedPins.length > 0) {
      warnings.push(`${affectedPins.length} active community alert${affectedPins.length > 1 ? 's' : ''} near this route`);
    }
    if (adjustedScore != null && adjustedScore < 40) {
      warnings.push('This route passes through areas with elevated crime rates');
    }
    if (safetyMode) {
      const vulnPins = affectedPins.filter((p: any) => ['harassment', 'pickpocket', 'unsafe_area'].includes(p.type));
      if (vulnPins.length > 0) {
        warnings.push(`Safety Mode: ${vulnPins.length} harassment/safety alert${vulnPins.length > 1 ? 's' : ''} reported near this route`);
      }
    }

    return {
      id: `route-${index}`,
      label: 'balanced',
      mapboxRouteId: `${dto.origin.lat},${dto.origin.lng}-${dto.destination.lat},${dto.destination.lng}-${index}`,
      polyline,
      safetyScore: adjustedScore,
      safetyGrade: adjustedScore != null ? this.zoneScorer.toGrade(adjustedScore) : null,
      durationMinutes,
      distanceKm,
      affectedPins,
      segmentScores: adjustedScore != null ? [{
        polyline,
        safetyScore: adjustedScore,
        colour: this.zoneScorer.toColour(adjustedScore),
      }] : [],
      warnings,
      dataSource: safetyResult.source
        ? `${safetyResult.source} (${safetyResult.granularity})`
        : null,
      userRating,
    };
  }

  private sortRoutes(routes: Awaited<ReturnType<typeof this.scoreRoute>>[], prioritize: string) {
    return [...routes].sort((a, b) => {
      if (prioritize === 'safety') {
        const scoreA = a.safetyScore ?? 50;
        const scoreB = b.safetyScore ?? 50;
        return scoreB - scoreA;
      }
      if (prioritize === 'speed') {
        return a.durationMinutes - b.durationMinutes;
      }
      // balanced: weighted composite
      const scoreA = (a.safetyScore ?? 50) * 0.6 + (100 - (a.durationMinutes / 60) * 10) * 0.4;
      const scoreB = (b.safetyScore ?? 50) * 0.6 + (100 - (b.durationMinutes / 60) * 10) * 0.4;
      return scoreB - scoreA;
    });
  }

  private async getPinsNearRoute(minLat: number, minLng: number, maxLat: number, maxLng: number) {
    return this.db
      .select({
        id: pins.id,
        type: pins.type,
        title: pins.title,
        lat: pins.lat,
        lng: pins.lng,
        upvotes: pins.upvotes,
        downvotes: pins.downvotes,
      })
      .from(pins)
      .where(
        and(
          eq(pins.status, 'active'),
          or(
            isNull(pins.expiresAt),
            gt(pins.expiresAt, new Date()),
          ),
          sql`${pins.lat}::numeric BETWEEN ${minLat - PIN_ROUTE_BUFFER_DEG} AND ${maxLat + PIN_ROUTE_BUFFER_DEG}`,
          sql`${pins.lng}::numeric BETWEEN ${minLng - PIN_ROUTE_BUFFER_DEG} AND ${maxLng + PIN_ROUTE_BUFFER_DEG}`,
        ),
      );
  }

  private async getRouteUserRating(originLat: number, originLng: number, destLat: number, destLng: number) {
    const TOLERANCE = 0.01; // ~1km tolerance for fuzzy route match

    const result = await this.db
      .select({
        average: avg(routeRatings.overallRating),
        total: count(routeRatings.id),
      })
      .from(routeRatings)
      .where(
        and(
          sql`ABS(${routeRatings.originLat}::numeric - ${originLat}) < ${TOLERANCE}`,
          sql`ABS(${routeRatings.originLng}::numeric - ${originLng}) < ${TOLERANCE}`,
          sql`ABS(${routeRatings.destinationLat}::numeric - ${destLat}) < ${TOLERANCE}`,
          sql`ABS(${routeRatings.destinationLng}::numeric - ${destLng}) < ${TOLERANCE}`,
        ),
      );

    const row = result[0];
    if (!row || !row.total || Number(row.total) === 0) return null;

    return {
      average: Math.round(Number(row.average) * 10) / 10,
      count: Number(row.total),
    };
  }
}

// ------- Mapbox API types -------
interface MapboxRoute {
  geometry: string;
  duration: number;
  distance: number;
}

interface MapboxDirectionsResponse {
  routes?: MapboxRoute[];
  code?: string;
  message?: string;
}

interface MapboxGeocodeFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface MapboxGeocodeResponse {
  features?: MapboxGeocodeFeature[];
}
