import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, between, eq, gt, or, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { safetyZones, dataIngestionLogs } from '../../database/schema';
import { ICrimeDataAdapter, SafetyZoneInput } from './adapters/adapter.interface';
import { ZoneScorer } from './scoring/zone-scorer';

export const INGESTION_QUEUE = 'safety-ingestion';

@Injectable()
export class SafetyEngineService {
  private readonly logger = new Logger(SafetyEngineService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectQueue(INGESTION_QUEUE) private readonly ingestionQueue: Queue,
    private readonly zoneScorer: ZoneScorer,
  ) {}

  /**
   * Trigger an ingestion job for a specific source.
   */
  async triggerIngestion(source: string): Promise<void> {
    await this.ingestionQueue.add('ingest', { source }, { jobId: `ingest-${source}-${Date.now()}` });
    this.logger.log(`Queued ingestion job for source: ${source}`);
  }

  /**
   * Trigger ingestion for all sources.
   */
  async triggerAllIngestion(): Promise<void> {
    for (const source of ['uk_police', 'eurostat', 'fbi', 'us_travel_advisory']) {
      await this.triggerIngestion(source);
    }
  }

  /**
   * Ingest zone data from an adapter and persist to DB.
   * Called by the BullMQ processor.
   */
  async ingestFromAdapter(adapter: ICrimeDataAdapter): Promise<{ created: number; updated: number }> {
    const startedAt = new Date();
    let zonesCreated = 0;
    let zonesUpdated = 0;
    let errorMessage: string | undefined;

    try {
      const zones = await adapter.ingest();

      for (const zone of zones) {
        const safetyScore = this.zoneScorer.score(zone.crimeData, zone.sourceGranularity);
        await this.upsertZone(zone, safetyScore);

        if (await this.isNewZone(zone)) {
          zonesCreated++;
        } else {
          zonesUpdated++;
        }
      }

      this.logger.log(
        `${adapter.sourceName}: ingested ${zones.length} zones (${zonesCreated} new, ${zonesUpdated} updated)`,
      );
    } catch (err) {
      errorMessage = (err as Error).message;
      this.logger.error(`Ingestion failed for ${adapter.sourceName}: ${errorMessage}`);
    } finally {
      await this.db.insert(dataIngestionLogs).values({
        source: adapter.sourceName,
        status: errorMessage ? 'failed' : 'success',
        zonesCreated,
        zonesUpdated,
        errorMessage: errorMessage ?? null,
        startedAt,
        completedAt: new Date(),
      });
    }

    return { created: zonesCreated, updated: zonesUpdated };
  }

  /**
   * Get safety score for a lat/lng point.
   * Finds the most specific zone containing the point.
   */
  async getSafetyScore(lat: number, lng: number): Promise<{
    score: number | null;
    source: string | null;
    granularity: string | null;
    dataAvailable: boolean;
  }> {
    // Try to find a zone containing this point — prefer finest granularity
    const zone = await this.findBestZoneForPoint(lat, lng);

    if (!zone) {
      return { score: null, source: null, granularity: null, dataAvailable: false };
    }

    return {
      score: Number(zone.safetyScore),
      source: zone.source,
      granularity: zone.sourceGranularity,
      dataAvailable: true,
    };
  }

  /**
   * Get all active safety zones within a bounding box (for map overlay).
   */
  async getZonesInBbox(minLat: number, minLng: number, maxLat: number, maxLng: number) {
    return this.db
      .select({
        id: safetyZones.id,
        source: safetyZones.source,
        sourceGranularity: safetyZones.sourceGranularity,
        centerLat: safetyZones.centerLat,
        centerLng: safetyZones.centerLng,
        radiusMetres: safetyZones.radiusMetres,
        bboxMinLat: safetyZones.bboxMinLat,
        bboxMinLng: safetyZones.bboxMinLng,
        bboxMaxLat: safetyZones.bboxMaxLat,
        bboxMaxLng: safetyZones.bboxMaxLng,
        safetyScore: safetyZones.safetyScore,
      })
      .from(safetyZones)
      .where(
        and(
          or(
            isNull(safetyZones.expiresAt),
            gt(safetyZones.expiresAt, new Date()),
          ),
          or(
            // Point-based zone overlaps bbox
            and(
              between(safetyZones.centerLat, String(minLat), String(maxLat)),
              between(safetyZones.centerLng, String(minLng), String(maxLng)),
            ),
            // Bbox-based zone overlaps query bbox
            and(
              sql`${safetyZones.bboxMinLat} <= ${maxLat}`,
              sql`${safetyZones.bboxMaxLat} >= ${minLat}`,
              sql`${safetyZones.bboxMinLng} <= ${maxLng}`,
              sql`${safetyZones.bboxMaxLng} >= ${minLng}`,
            ),
          ),
        ),
      );
  }

  async getIngestionLogs(limit = 50) {
    return this.db
      .select()
      .from(dataIngestionLogs)
      .orderBy(sql`${dataIngestionLogs.startedAt} DESC`)
      .limit(limit);
  }

  private async upsertZone(zone: SafetyZoneInput, safetyScore: number): Promise<void> {
    const expiresAt = this.computeExpiry(zone.source);

    const data = {
      source: zone.source as typeof safetyZones.$inferInsert['source'],
      sourceRegion: zone.sourceRegion,
      sourceGranularity: zone.sourceGranularity as typeof safetyZones.$inferInsert['sourceGranularity'],
      centerLat: zone.centerLat != null ? String(zone.centerLat) : null,
      centerLng: zone.centerLng != null ? String(zone.centerLng) : null,
      radiusMetres: zone.radiusMetres ?? null,
      bboxMinLat: zone.bboxMinLat != null ? String(zone.bboxMinLat) : null,
      bboxMinLng: zone.bboxMinLng != null ? String(zone.bboxMinLng) : null,
      bboxMaxLat: zone.bboxMaxLat != null ? String(zone.bboxMaxLat) : null,
      bboxMaxLng: zone.bboxMaxLng != null ? String(zone.bboxMaxLng) : null,
      safetyScore: String(safetyScore),
      crimeData: zone.crimeData as object,
      periodStart: zone.periodStart.toISOString().split('T')[0],
      periodEnd: zone.periodEnd.toISOString().split('T')[0],
      fetchedAt: new Date(),
      expiresAt,
      updatedAt: new Date(),
    };

    // Upsert by source + sourceRegion (one zone per region per source)
    const existing = await this.db
      .select({ id: safetyZones.id })
      .from(safetyZones)
      .where(
        and(
          eq(safetyZones.source, zone.source as typeof safetyZones.$inferInsert['source']),
          eq(safetyZones.sourceRegion, zone.sourceRegion),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(safetyZones)
        .set(data)
        .where(eq(safetyZones.id, existing[0].id));
    } else {
      await this.db.insert(safetyZones).values({ ...data, createdAt: new Date() });
    }
  }

  private async isNewZone(zone: SafetyZoneInput): Promise<boolean> {
    const existing = await this.db
      .select({ id: safetyZones.id })
      .from(safetyZones)
      .where(
        and(
          eq(safetyZones.source, zone.source as typeof safetyZones.$inferInsert['source']),
          eq(safetyZones.sourceRegion, zone.sourceRegion),
        ),
      )
      .limit(1);
    return existing.length === 0;
  }

  private async findBestZoneForPoint(lat: number, lng: number) {
    const granularityOrder = ['street', 'neighbourhood', 'city', 'country'];

    for (const granularity of granularityOrder) {
      const [zone] = await this.db
        .select()
        .from(safetyZones)
        .where(
          and(
            eq(safetyZones.sourceGranularity, granularity as typeof safetyZones.$inferInsert['sourceGranularity']),
            or(
              isNull(safetyZones.expiresAt),
              gt(safetyZones.expiresAt, new Date()),
            ),
            or(
              // Bbox containment
              and(
                sql`${safetyZones.bboxMinLat} <= ${lat}`,
                sql`${safetyZones.bboxMaxLat} >= ${lat}`,
                sql`${safetyZones.bboxMinLng} <= ${lng}`,
                sql`${safetyZones.bboxMaxLng} >= ${lng}`,
              ),
              // Rough point proximity (center within reasonable distance)
              and(
                between(safetyZones.centerLat, String(lat - 0.5), String(lat + 0.5)),
                between(safetyZones.centerLng, String(lng - 0.5), String(lng + 0.5)),
              ),
            ),
          ),
        )
        .limit(1);

      if (zone) return zone;
    }

    return null;
  }

  private computeExpiry(source: string): Date {
    const now = new Date();
    switch (source) {
      case 'uk_police':
        // Refresh monthly — expire after 35 days
        return new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);
      case 'eurostat':
      case 'fbi':
        // Annual data — expire after 400 days
        return new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000);
      case 'us_travel_advisory':
        // Travel advisories update irregularly — expire after 90 days
        return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }
}
