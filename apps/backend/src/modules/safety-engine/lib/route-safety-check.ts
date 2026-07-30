import * as turf from '@turf/turf';
import type { Feature, LineString } from 'geojson';
import { cellToBoundary, cellToLatLng, gridRingUnsafe, latLngToCell } from 'h3-js';
import type { DrizzleDB } from '../../../database/database.module';
import { sql } from 'drizzle-orm';

const FLAGGED_BANDS = new Set(['red', 'purple']);
const DEFAULT_RES = 9;
const NEIGHBOUR_RINGS = 2;

interface ScoreRow {
  h3_index: string;
  score: number | null;
  band: string;
}

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

function cellsAlongLine(
  line: Feature<LineString>,
  resolution: number,
  sampleMeters = 50,
): string[] {
  const length = turf.length(line, { units: 'meters' });
  const steps = Math.max(1, Math.ceil(length / sampleMeters));
  const seen = new Set<string>();
  for (let i = 0; i <= steps; i++) {
    const along = turf.along(line, (i / steps) * length, { units: 'meters' });
    const [lng, lat] = along.geometry.coordinates as [number, number];
    seen.add(latLngToCell(lat, lng, resolution));
  }
  return Array.from(seen);
}

async function fetchScoresFor(
  db: DrizzleDB,
  cells: string[],
  resolution: number,
): Promise<Map<string, ScoreRow>> {
  const out = new Map<string, ScoreRow>();
  if (!cells.length) return out;

  const chunkSize = 1000;
  for (let i = 0; i < cells.length; i += chunkSize) {
    const chunk = cells.slice(i, i + chunkSize);
    const result = await db.execute(
      sql`SELECT h3_index, score, band
          FROM h3_safety_scores
          WHERE resolution = ${resolution} AND h3_index = ANY(${chunk}::text[])`,
    );
    for (const row of result as unknown as ScoreRow[]) {
      out.set(row.h3_index, row);
    }
  }
  return out;
}

function suggestWaypoint(
  flaggedCell: string,
  scores: Map<string, ScoreRow>,
): Omit<SuggestedWaypoint, 'avoidH3'> | null {
  for (let r = 1; r <= NEIGHBOUR_RINGS; r++) {
    const ring = (gridRingUnsafe(flaggedCell, r) as string[]) ?? [];
    for (const candidate of ring) {
      const sc = scores.get(candidate);
      if (sc && !FLAGGED_BANDS.has(sc.band)) {
        const [lat, lng] = cellToLatLng(candidate) as [number, number];
        return { h3: candidate, lat, lng, band: sc.band };
      }
    }
  }
  return null;
}

export async function checkRouteSafety(
  db: DrizzleDB,
  lineString: Feature<LineString>,
  resolution = DEFAULT_RES,
): Promise<RouteSafetyResult> {
  if (!lineString || lineString.type !== 'Feature' || lineString.geometry?.type !== 'LineString') {
    throw new Error('lineString must be a GeoJSON Feature<LineString>');
  }
  if (![7, 9, 11].includes(resolution)) {
    throw new Error('resolution must be 7, 9 or 11');
  }

  const candidates = cellsAlongLine(lineString, resolution);
  const scores = await fetchScoresFor(db, candidates, resolution);

  // Pre-load neighbour scores for suggestion lookups
  const neighbourSet = new Set<string>();
  for (const cell of candidates) {
    for (let r = 1; r <= NEIGHBOUR_RINGS; r++) {
      for (const n of (gridRingUnsafe(cell, r) as string[]) ?? []) {
        neighbourSet.add(n);
      }
    }
  }
  const neighboursToFetch = Array.from(neighbourSet).filter((c) => !scores.has(c));
  const neighbourScores = await fetchScoresFor(db, neighboursToFetch, resolution);
  for (const [k, v] of neighbourScores) scores.set(k, v);

  const flaggedSegments: FlaggedSegment[] = [];
  const suggestedWaypoints: SuggestedWaypoint[] = [];
  const seenSuggestions = new Set<string>();

  for (const cell of candidates) {
    const sc = scores.get(cell);
    if (!sc || !FLAGGED_BANDS.has(sc.band)) continue;

    const boundary = (cellToBoundary(cell, true) as [number, number][]);
    const ring = [...boundary, boundary[0]];
    const cellPoly = turf.polygon([ring], { h3: cell });
    const intersection = turf.lineIntersect(lineString, cellPoly);

    let segment: FlaggedSegment;
    if (intersection.features.length >= 2) {
      const pts = intersection.features.map((f) => f.geometry.coordinates as [number, number]);
      segment = {
        h3: cell,
        band: sc.band,
        score: Number(sc.score ?? 0),
        from: pts[0],
        to: pts[pts.length - 1],
      };
    } else {
      const [lat, lng] = cellToLatLng(cell) as [number, number];
      segment = {
        h3: cell,
        band: sc.band,
        score: Number(sc.score ?? 0),
        from: [lng, lat],
        to: [lng, lat],
      };
    }
    flaggedSegments.push(segment);

    const suggestion = suggestWaypoint(cell, scores);
    if (suggestion && !seenSuggestions.has(suggestion.h3)) {
      seenSuggestions.add(suggestion.h3);
      suggestedWaypoints.push({ avoidH3: cell, ...suggestion });
    }
  }

  return {
    resolution,
    bbox: turf.bbox(lineString) as [number, number, number, number],
    cellsChecked: candidates.length,
    flaggedSegments,
    suggestedWaypoints,
  };
}
