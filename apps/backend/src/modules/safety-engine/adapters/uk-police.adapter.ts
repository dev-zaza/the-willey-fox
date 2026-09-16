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

/** City centres + London borough / neighbourhood centroids for denser street coverage. */
const UK_AREAS = [
  { name: 'London',            lat: 51.5074, lng: -0.1278 },
  { name: 'Mayfair',           lat: 51.5100, lng: -0.1470 },
  { name: 'Westminster',       lat: 51.4975, lng: -0.1357 },
  { name: 'Soho',              lat: 51.5136, lng: -0.1365 },
  { name: 'Camden',            lat: 51.5390, lng: -0.1426 },
  { name: 'Islington',         lat: 51.5362, lng: -0.1033 },
  { name: 'Hackney',           lat: 51.5450, lng: -0.0553 },
  { name: 'Tower Hamlets',     lat: 51.5203, lng: -0.0293 },
  { name: 'Southwark',         lat: 51.5035, lng: -0.0804 },
  { name: 'Lambeth',           lat: 51.4571, lng: -0.1231 },
  { name: 'Kensington',        lat: 51.4991, lng: -0.1938 },
  { name: 'Hammersmith',       lat: 51.4927, lng: -0.2339 },
  { name: 'Greenwich',         lat: 51.4826, lng: 0.0077 },
  { name: 'Brixton',           lat: 51.4613, lng: -0.1156 },
  { name: 'Shoreditch',        lat: 51.5260, lng: -0.0780 },
  { name: 'Canary Wharf',      lat: 51.5054, lng: -0.0235 },
  { name: 'Manchester',        lat: 53.4808, lng: -2.2426 },
  { name: 'Salford',           lat: 53.4875, lng: -2.2901 },
  { name: 'Birmingham',        lat: 52.4862, lng: -1.8904 },
  { name: 'Liverpool',         lat: 53.4084, lng: -2.9916 },
  { name: 'Leeds',             lat: 53.8008, lng: -1.5491 },
  { name: 'Bristol',           lat: 51.4545, lng: -2.5879 },
  { name: 'Newcastle',         lat: 54.9783, lng: -1.6178 },
  { name: 'Cardiff',           lat: 51.4816, lng: -3.1791 },
  { name: 'Belfast',           lat: 54.5973, lng: -5.9301 },
  { name: 'Brighton',          lat: 50.8225, lng: -0.1372 },
  { name: 'Sheffield',         lat: 53.3811, lng: -1.4701 },
  { name: 'Nottingham',        lat: 52.9548, lng: -1.1581 },
  { name: 'Leicester',         lat: 52.6369, lng: -1.1398 },
  { name: 'Oxford',            lat: 51.7520, lng: -1.2577 },
  { name: 'Cambridge',         lat: 52.2053, lng: 0.1218 },
  { name: 'Reading',           lat: 51.4543, lng: -0.9781 },
  { name: 'Southampton',       lat: 50.9097, lng: -1.4044 },
  { name: 'Edinburgh',         lat: 55.9533, lng: -3.1883 },
  { name: 'Glasgow',           lat: 55.8642, lng: -4.2518 },
];

/** Rough cache so repeated hex clicks do not hammer police.uk (TTL 6h). */
const ON_DEMAND_TTL_MS = 6 * 60 * 60 * 1000;
const onDemandCache = new Map<string, number>();

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
        const { crimeCount, upserted, categories } = await this.ingestPoint(
          area.lat,
          area.lng,
          date,
        );
        fetched += crimeCount;
        inserted += upserted;

        results.push({
          source: this.sourceName,
          sourceRegion: area.name,
          sourceGranularity: 'street',
          centerLat: area.lat,
          centerLng: area.lng,
          radiusMetres: 1609,
          crimeData: this.aggregateZoneCategories(categories),
          periodStart: new Date(`${date}-01`),
          periodEnd: new Date(`${date}-01`),
        });
        this.logger.debug(`${area.name}: fetched=${crimeCount} upserted=${upserted}`);
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

  /**
   * On-demand street crime pull for a clicked map point (≈1 mile radius via police.uk).
   * Cached per ~0.01° grid cell for 6 hours.
   */
  async fetchAndUpsertAt(lat: number, lng: number): Promise<number> {
    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const now = Date.now();
    const last = onDemandCache.get(cacheKey);
    if (last != null && now - last < ON_DEMAND_TTL_MS) {
      return 0;
    }
    onDemandCache.set(cacheKey, now);

    const date = await this.fetchLatestAvailableMonth();
    const { upserted } = await this.ingestPoint(lat, lng, date);
    this.logger.log(`On-demand UK crime at ${cacheKey}: upserted=${upserted}`);
    return upserted;
  }

  private async ingestPoint(
    lat: number,
    lng: number,
    date: string,
  ): Promise<{ crimeCount: number; upserted: number; categories: string[] }> {
    const url =
      `${BASE_URL}/crimes-street/all-crime` +
      `?lat=${lat}&lng=${lng}&date=${date}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });

    if (!response.ok) {
      this.logger.warn(`UK Police API returned ${response.status} for ${lat},${lng}`);
      return { crimeCount: 0, upserted: 0, categories: [] };
    }

    const crimes = (await response.json()) as Array<{
      category: string;
      persistent_id: string;
      month: string;
      location: { latitude: string; longitude: string; street?: { id?: string } };
    }>;

    const rows: IncidentRow[] = [];
    const categories: string[] = [];
    for (const raw of crimes) {
      categories.push(raw.category);
      const crimeLat = Number(raw.location?.latitude);
      const crimeLng = Number(raw.location?.longitude);
      if (!Number.isFinite(crimeLat) || !Number.isFinite(crimeLng)) continue;

      const incidentDate = raw.month ? `${raw.month}-01` : null;
      const id =
        raw.persistent_id?.length > 0
          ? raw.persistent_id
          : 'syn_' + crypto
              .createHash('sha1')
              .update([raw.category, crimeLat, crimeLng, raw.month, raw.location?.street?.id ?? ''].join('|'))
              .digest('hex')
              .slice(0, 24);

      rows.push({
        source_country: SOURCE_COUNTRY,
        source_api: SOURCE_API,
        source_record_id: id,
        crime_type: raw.category,
        severity_category: categoriseUK(raw.category),
        incident_count: 1,
        lat: crimeLat,
        lng: crimeLng,
        incident_date: incidentDate,
        ...indexLatLng(crimeLat, crimeLng),
      });
    }

    const upserted = await upsertIncidents(this.db, rows, { batchSize: BATCH_SIZE });
    return { crimeCount: crimes.length, upserted, categories };
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
