import { Injectable, Logger, Inject } from '@nestjs/common';
import crypto from 'node:crypto';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { ICrimeDataAdapter, SafetyZoneInput, NormalizedCrimeData } from './adapter.interface';
import { indexLatLng } from '../lib/h3';
import { categoriseUK } from '../lib/normalise';
import { upsertIncidents, IncidentRow } from '../lib/upsert';
import { logPipelineRun } from '../lib/pipeline-log';

const SOURCE_API = 'uk_police';
const SOURCE_COUNTRY = 'GB';
const BASE_URL = 'https://data.police.uk/api';
const BATCH_SIZE = 500;

const UK_AREAS = [
  { name: 'London',     lat: 51.5074, lng: -0.1278 },
  { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
  { name: 'Birmingham', lat: 52.4862, lng: -1.8904 },
  { name: 'Liverpool',  lat: 53.4084, lng: -2.9916 },
  { name: 'Leeds',      lat: 53.8008, lng: -1.5491 },
  { name: 'Bristol',    lat: 51.4545, lng: -2.5879 },
  { name: 'Newcastle',  lat: 54.9783, lng: -1.6178 },
  { name: 'Cardiff',    lat: 51.4816, lng: -3.1791 },
  { name: 'Belfast',    lat: 54.5973, lng: -5.9301 },
  { name: 'Brighton',   lat: 50.8225, lng: -0.1372 },
];

@Injectable()
export class UkPoliceAdapter implements ICrimeDataAdapter {
  readonly sourceName = SOURCE_API;
  private readonly logger = new Logger(UkPoliceAdapter.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async ingest(): Promise<SafetyZoneInput[]> {
    const results: SafetyZoneInput[] = [];
    const date = await this.fetchLatestAvailableMonth();
    let fetched = 0;
    let inserted = 0;
    const errors: string[] = [];

    for (const area of UK_AREAS) {
      try {
        const url =
          `${BASE_URL}/crimes-street/all-crime` +
          `?lat=${area.lat}&lng=${area.lng}&date=${date}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });

        if (!response.ok) {
          this.logger.warn(`UK Police API returned ${response.status} for ${area.name}`);
          continue;
        }

        const crimes = (await response.json()) as Array<{
          category: string;
          persistent_id: string;
          month: string;
          location: { latitude: string; longitude: string; street?: { id?: string } };
        }>;
        fetched += crimes.length;

        const rows: IncidentRow[] = [];
        for (const raw of crimes) {
          const lat = Number(raw.location?.latitude);
          const lng = Number(raw.location?.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const incidentDate = raw.month ? `${raw.month}-01` : null;
          const id =
            raw.persistent_id?.length > 0
              ? raw.persistent_id
              : 'syn_' + crypto
                  .createHash('sha1')
                  .update([raw.category, lat, lng, raw.month, raw.location?.street?.id ?? ''].join('|'))
                  .digest('hex')
                  .slice(0, 24);

          rows.push({
            source_country: SOURCE_COUNTRY,
            source_api: SOURCE_API,
            source_record_id: id,
            crime_type: raw.category,
            severity_category: categoriseUK(raw.category),
            incident_count: 1,
            lat,
            lng,
            incident_date: incidentDate,
            ...indexLatLng(lat, lng),
          });
        }

        inserted += await upsertIncidents(this.db, rows, { batchSize: BATCH_SIZE });
        this.logger.debug(`${area.name}: fetched=${crimes.length} upserted=${rows.length}`);

        // Keep zone data for backward-compat with SafetyEngineService
        const categoryCounts = this.aggregateZoneCategories(crimes.map((c) => c.category));
        results.push({
          source: this.sourceName,
          sourceRegion: area.name,
          sourceGranularity: 'street',
          centerLat: area.lat,
          centerLng: area.lng,
          radiusMetres: 1609,
          crimeData: categoryCounts,
          periodStart: new Date(`${date}-01`),
          periodEnd: new Date(`${date}-01`),
        });
      } catch (err) {
        const msg = `${area.name}: ${(err as Error).message}`;
        this.logger.error(msg);
        errors.push(msg);
      }
    }

    await logPipelineRun(this.db, {
      source: SOURCE_API,
      recordsFetched: fetched,
      recordsInserted: inserted,
      errors: errors.length ? errors.join('; ') : null,
    });

    return results;
  }

  private aggregateZoneCategories(categories: string[]): NormalizedCrimeData[] {
    const counts: Record<string, number> = {};
    for (const cat of categories) {
      const mapped = categoriseUK(cat);
      counts[mapped] = (counts[mapped] ?? 0) + 1;
    }
    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  }

  private async fetchLatestAvailableMonth(): Promise<string> {
    try {
      const res = await fetch(`${BASE_URL}/crime-last-updated`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const json = (await res.json()) as { date: string };
        return String(json.date).slice(0, 7);
      }
    } catch {
      // fall through to date math fallback
    }
    // 2-month lag fallback
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
