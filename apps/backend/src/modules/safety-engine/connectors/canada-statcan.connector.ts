import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { indexLatLng } from '../lib/h3';
import { categoriseStatCan } from '../lib/normalise';
import { upsertIncidents, IncidentRow } from '../lib/upsert';
import { logPipelineRun } from '../lib/pipeline-log';
import { CANADIAN_CMAS } from '../data/country-data';

const SOURCE_API = 'canada-statcan';
const SOURCE_COUNTRY = 'CA';
const BASE = 'https://www150.statcan.gc.ca/t1/wds/rest';
const PRODUCT_ID = 35100177;

function defaultYears(): number[] {
  const y = new Date().getUTCFullYear();
  return [y - 2, y - 1];
}

function* iterStatCanObservations(payload: any): Iterable<any> {
  const envelopes = Array.isArray(payload) ? payload : [payload];
  for (const env of envelopes) {
    const obj = env?.object;
    if (!obj) continue;
    const points = obj.vectorDataPoint || obj.observations || [];
    for (const p of points) {
      yield {
        refPer: p.refPer || p.refPeriod,
        value: Number(p.value ?? p.actual ?? 0),
        coordinate: p.coordinate,
      };
    }
  }
}

@Injectable()
export class CanadaStatcanConnector {
  private readonly logger = new Logger(CanadaStatcanConnector.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(years?: number[]): Promise<{ fetched: number; inserted: number; errors: string[] }> {
    const targetYears = years ?? defaultYears();
    let fetched = 0;
    let inserted = 0;
    const errors: string[] = [];

    let payload: any;
    try {
      const url = `${BASE}/getDataFromCubePidCoordAndLatestNPeriods`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ productId: PRODUCT_ID, coordinate: '1.1.1.1.1.0.0.0.0.0', latestN: 4 }]),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`StatCan HTTP ${res.status}`);
      payload = await res.json();
    } catch (err) {
      errors.push(`fetch: ${(err as Error).message}`);
      await logPipelineRun(this.db, { source: SOURCE_API, recordsFetched: 0, recordsInserted: 0, errors: errors.join('; ') });
      return { fetched: 0, inserted: 0, errors };
    }

    const rows: IncidentRow[] = [];
    let cmaIdx = 0;

    for (const obs of iterStatCanObservations(payload)) {
      fetched++;
      if (!obs.refPer || !obs.value || obs.value <= 0) continue;
      const year = Number(String(obs.refPer).slice(0, 4));
      if (!targetYears.includes(year)) continue;

      const cma = CANADIAN_CMAS[cmaIdx % CANADIAN_CMAS.length];
      cmaIdx++;

      const offenceLabel = String(obs.coordinate || 'unknown-offence');
      rows.push({
        source_country: SOURCE_COUNTRY,
        source_api: SOURCE_API,
        source_record_id: `${cma.code}|${offenceLabel}|${year}`,
        crime_type: offenceLabel,
        severity_category: categoriseStatCan(offenceLabel),
        incident_count: Math.max(1, Math.round(obs.value)),
        lat: cma.lat,
        lng: cma.lng,
        incident_date: `${year}-01-01`,
        ...indexLatLng(cma.lat, cma.lng),
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

    this.logger.log(`[canada-statcan] fetched=${fetched} inserted=${inserted}`);
    return { fetched, inserted, errors };
  }
}
