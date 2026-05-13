import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { safetyZones } from '../../../database/schema';

/**
 * Aggregates active safety-related pins into community-based safety zone scores.
 *
 * Runs every hour. Groups pins into ~500m grid cells (≈0.005° lat/lng),
 * counts negative pins per cell, and upserts into safety_zones with source='community'.
 *
 * Cells with more negative pins get lower safety scores.
 * Recommendation pins contribute positively.
 */

/** Pin types that indicate danger (lower the safety score) */
const NEGATIVE_PIN_TYPES = [
  'hazard',
  'safety_alert',
  'pickpocket',
  'roadblock',
  'harassment',
  'unsafe_area',
] as const;

/** Pin types that indicate safety (raise the safety score) */
const POSITIVE_PIN_TYPES = ['recommendation'] as const;

/** Grid cell size in degrees (~500m at mid-latitudes) */
const CELL_SIZE = 0.005;

/** Minimum pins in a cell to generate a zone (avoids noise) */
const MIN_PINS_FOR_ZONE = 2;

/** Community zones expire after 6 hours (re-computed hourly) */
const EXPIRY_HOURS = 6;

interface GridCell {
  cellLat: number;
  cellLng: number;
  negativeCount: number;
  positiveCount: number;
}

@Injectable()
export class PinAggregationJob {
  private readonly logger = new Logger(PinAggregationJob.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @Cron(CronExpression.EVERY_HOUR)
  async aggregatePins(): Promise<void> {
    this.logger.log('Starting community pin aggregation...');

    const cells = await this.getGridCells();

    let upserted = 0;
    for (const cell of cells) {
      const totalPins = cell.negativeCount + cell.positiveCount;
      if (totalPins < MIN_PINS_FOR_ZONE) continue;

      const safetyScore = this.computeCellScore(
        cell.negativeCount,
        cell.positiveCount,
      );

      await this.upsertCommunityZone(cell, safetyScore);
      upserted++;
    }

    // Clean up stale community zones that no longer have enough pins
    await this.cleanupStaleZones(cells);

    this.logger.log(
      `Pin aggregation complete: ${upserted} community zones upserted from ${cells.length} cells`,
    );
  }

  private async getGridCells(): Promise<GridCell[]> {
    // Use SQL to bucket pins into grid cells and count by safety impact
    const negativePinTypes = NEGATIVE_PIN_TYPES as readonly string[];
    const positivePinTypes = POSITIVE_PIN_TYPES as readonly string[];

    const result = await this.db.execute(sql`
      SELECT
        FLOOR(CAST(lat AS numeric) / ${CELL_SIZE}) * ${CELL_SIZE} AS cell_lat,
        FLOOR(CAST(lng AS numeric) / ${CELL_SIZE}) * ${CELL_SIZE} AS cell_lng,
        COUNT(*) FILTER (WHERE type = ANY(${negativePinTypes}::pin_type[])) AS negative_count,
        COUNT(*) FILTER (WHERE type = ANY(${positivePinTypes}::pin_type[])) AS positive_count
      FROM pins
      WHERE status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
        AND type = ANY(${[...negativePinTypes, ...positivePinTypes]}::pin_type[])
      GROUP BY cell_lat, cell_lng
    `);

    return (result as any[]).map((row: any) => ({
      cellLat: Number(row.cell_lat),
      cellLng: Number(row.cell_lng),
      negativeCount: Number(row.negative_count),
      positiveCount: Number(row.positive_count),
    }));
  }

  /**
   * Compute a 0–100 safety score for a cell.
   *
   * - 0 negative pins → 100 (safest)
   * - Each negative pin reduces the score by 15 points
   * - Each positive (recommendation) pin adds back 5 points
   * - Floor at 0, cap at 100
   */
  private computeCellScore(
    negativeCount: number,
    positiveCount: number,
  ): number {
    const base = 100;
    const penalty = negativeCount * 15;
    const bonus = positiveCount * 5;
    return Math.max(0, Math.min(100, base - penalty + bonus));
  }

  private async upsertCommunityZone(
    cell: GridCell,
    safetyScore: number,
  ): Promise<void> {
    const sourceRegion = `community_${cell.cellLat.toFixed(3)}_${cell.cellLng.toFixed(3)}`;
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);
    const now = new Date();

    const data = {
      source: 'community' as const,
      sourceRegion,
      sourceGranularity: 'neighbourhood' as const,
      centerLat: String(cell.cellLat + CELL_SIZE / 2),
      centerLng: String(cell.cellLng + CELL_SIZE / 2),
      radiusMetres: 350, // ~500m diagonal coverage
      bboxMinLat: String(cell.cellLat),
      bboxMinLng: String(cell.cellLng),
      bboxMaxLat: String(cell.cellLat + CELL_SIZE),
      bboxMaxLng: String(cell.cellLng + CELL_SIZE),
      safetyScore: String(safetyScore),
      crimeData: [
        { category: 'community_negative_pins', count: cell.negativeCount },
        { category: 'community_positive_pins', count: cell.positiveCount },
      ] as object,
      periodStart: now.toISOString().split('T')[0],
      periodEnd: now.toISOString().split('T')[0],
      fetchedAt: now,
      expiresAt,
      updatedAt: now,
    };

    const existing = await this.db
      .select({ id: safetyZones.id })
      .from(safetyZones)
      .where(
        and(
          eq(safetyZones.source, 'community'),
          eq(safetyZones.sourceRegion, sourceRegion),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(safetyZones)
        .set(data)
        .where(eq(safetyZones.id, existing[0].id));
    } else {
      await this.db
        .insert(safetyZones)
        .values({ ...data, createdAt: now });
    }
  }

  /**
   * Remove community zones whose grid cell no longer has enough pins.
   */
  private async cleanupStaleZones(activeCells: GridCell[]): Promise<void> {
    const activeRegions = activeCells
      .filter(
        (c) => c.negativeCount + c.positiveCount >= MIN_PINS_FOR_ZONE,
      )
      .map(
        (c) => `community_${c.cellLat.toFixed(3)}_${c.cellLng.toFixed(3)}`,
      );

    // Delete community zones that are no longer backed by enough active pins
    if (activeRegions.length === 0) {
      // No active cells — delete all community zones
      await this.db
        .delete(safetyZones)
        .where(eq(safetyZones.source, 'community'));
    } else {
      await this.db.execute(sql`
        DELETE FROM safety_zones
        WHERE source = 'community'
          AND source_region != ALL(${activeRegions}::text[])
      `);
    }
  }
}
