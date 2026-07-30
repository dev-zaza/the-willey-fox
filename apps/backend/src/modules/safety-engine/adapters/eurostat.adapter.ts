import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { ICrimeDataAdapter, SafetyZoneInput } from './adapter.interface';
import { indexLatLng } from '../lib/h3';
import { categoriseICCS } from '../lib/normalise';
import { iterJsonStat } from '../lib/jsonstat';
import { upsertIncidents, IncidentRow } from '../lib/upsert';
import { logPipelineRun } from '../lib/pipeline-log';
import { COUNTRIES } from '../data/country-data';

const SOURCE_API = 'eurostat';
const BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/crim_off_cat';

const DEFAULT_COUNTRIES = [
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
];

function defaultYears(): number[] {
  const y = new Date().getUTCFullYear();
  return [y - 3, y - 2];
}

@Injectable()
export class EurostatAdapter implements ICrimeDataAdapter {
  readonly sourceName = SOURCE_API;
  private readonly logger = new Logger(EurostatAdapter.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async ingest(): Promise<SafetyZoneInput[]> {
    const targetCountries = (process.env.EU_COUNTRIES ?? DEFAULT_COUNTRIES.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
    const targetYears = defaultYears();

    let fetched = 0;
    let inserted = 0;
    const errors: string[] = [];

    const params = new URLSearchParams({ format: 'JSON', lang: 'en' });
    targetCountries.forEach((c) => params.append('geo', c));
    targetYears.forEach((y) => params.append('time', String(y)));
    params.append('unit', 'NR');

    let payload: any;
    try {
      const res = await fetch(`${BASE}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`Eurostat HTTP ${res.status}`);
      payload = await res.json();
    } catch (err) {
      errors.push(`fetch: ${(err as Error).message}`);
      await logPipelineRun(this.db, { source: SOURCE_API, recordsFetched: 0, recordsInserted: 0, errors: errors.join('; ') });
      return [];
    }

    const rows: IncidentRow[] = [];
    for (const r of iterJsonStat(payload)) {
      fetched++;
      if (!r.value || r.value <= 0) continue;

      const geo = String(r.geo ?? '');
      const iso = geo === 'EL' ? 'GR' : geo === 'UK' ? 'GB' : geo;
      const centroid = COUNTRIES[iso];
      if (!centroid) continue;

      const year = Number(r.time);
      if (!Number.isFinite(year)) continue;

      const iccs = String(r.iccs ?? '');

      rows.push({
        source_country: iso,
        source_api: SOURCE_API,
        source_record_id: `${iso}|${iccs}|${year}`,
        crime_type: iccs,
        severity_category: categoriseICCS(iccs),
        incident_count: Math.max(1, Math.round(r.value)),
        lat: centroid.lat,
        lng: centroid.lng,
        incident_date: `${year}-01-01`,
        ...indexLatLng(centroid.lat, centroid.lng),
      });
    }

    try {
      inserted = await upsertIncidents(this.db, rows);
    } catch (err) {
      errors.push(`upsert: ${(err as Error).message}`);
    }

    await logPipelineRun(this.db, {
      source: SOURCE_API,
      recordsFetched: fetched,
      recordsInserted: inserted,
      errors: errors.length ? errors.join('; ') : null,
    });

    this.logger.log(`Eurostat: fetched=${fetched} inserted=${inserted}`);
    return [];
  }
}
