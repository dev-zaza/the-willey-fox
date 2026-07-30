import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { indexLatLng } from '../lib/h3';
import { categoriseABS } from '../lib/normalise';
import { upsertIncidents, IncidentRow } from '../lib/upsert';
import { logPipelineRun } from '../lib/pipeline-log';
import { AUSTRALIAN_STATES } from '../data/country-data';

const SOURCE_API = 'australia-abs';
const SOURCE_COUNTRY = 'AU';
const BASE = 'https://api.data.abs.gov.au/data';
const DATAFLOW = 'RECORDED_CRIME_VICTIMS';

function defaultYears(): number[] {
  const y = new Date().getUTCFullYear();
  return [y - 2, y - 1];
}

function* iterSdmxObservations(payload: any): Iterable<any> {
  const data = payload?.data ?? payload;
  const dataset = data?.dataSets?.[0];
  if (!dataset) return;

  const dimDefs =
    data?.structure?.dimensions?.observation ??
    data?.structures?.[0]?.dimensions?.observation ?? [];
  const dimNames: string[] = dimDefs.map((d: any) => d.id);
  const dimValues: Array<Array<{ id: string; name: string }>> = dimDefs.map(
    (d: any) => d.values.map((v: any) => ({ id: v.id, name: v.name })),
  );

  const series = dataset.observations || dataset.series || {};
  for (const [key, obs] of Object.entries(series)) {
    const parts = (key as string).split(':').map(Number);
    const value = Array.isArray(obs) ? (obs as any)[0] : obs;
    const row: any = { value: Number(value) };
    parts.forEach((pos, idx) => {
      const dim = dimValues[idx]?.[pos];
      if (dim) row[dimNames[idx]] = dim;
    });
    yield row;
  }
}

function stateFromAbbr(code: string | undefined): (typeof AUSTRALIAN_STATES)[0] | null {
  if (!code) return null;
  const byCode = AUSTRALIAN_STATES.find((s) => s.code === String(code));
  if (byCode) return byCode;
  const abbr = String(code).toUpperCase();
  const lookup: Record<string, string> = {
    NSW: '1', VIC: '2', QLD: '3', SA: '4', WA: '5', TAS: '6', NT: '7', ACT: '8',
  };
  return AUSTRALIAN_STATES.find((s) => s.code === lookup[abbr]) ?? null;
}

@Injectable()
export class AustraliaAbsConnector {
  private readonly logger = new Logger(AustraliaAbsConnector.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(years?: number[]): Promise<{ fetched: number; inserted: number; errors: string[] }> {
    const targetYears = years ?? defaultYears();
    let fetched = 0;
    let inserted = 0;
    const errors: string[] = [];

    const startPeriod = Math.min(...targetYears);
    const endPeriod = Math.max(...targetYears);
    const url =
      `${BASE}/${DATAFLOW}/all` +
      `?startPeriod=${startPeriod}&endPeriod=${endPeriod}` +
      `&dimensionAtObservation=AllDimensions&format=jsondata`;

    let payload: any;
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/vnd.sdmx.data+json' },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`ABS HTTP ${res.status}`);
      payload = await res.json();
    } catch (err) {
      errors.push(`fetch: ${(err as Error).message}`);
      await logPipelineRun(this.db, { source: SOURCE_API, recordsFetched: 0, recordsInserted: 0, errors: errors.join('; ') });
      return { fetched: 0, inserted: 0, errors };
    }

    const rows: IncidentRow[] = [];
    for (const obs of iterSdmxObservations(payload)) {
      fetched++;
      if (!obs.value || obs.value <= 0) continue;

      const regionRef = obs.REGION ?? obs.STATE ?? obs.GEO;
      const offenceRef = obs.OFFENCE ?? obs.MEASURE ?? obs.OFFENCE_GROUP;
      const period = obs.TIME_PERIOD ?? obs.TIME;
      if (!regionRef || !offenceRef || !period) continue;

      const state = stateFromAbbr(regionRef.id);
      if (!state) continue;

      const year = Number(String(period.id).slice(0, 4));
      if (!Number.isFinite(year)) continue;

      const offenceLabel: string = offenceRef.name || offenceRef.id;
      rows.push({
        source_country: SOURCE_COUNTRY,
        source_api: SOURCE_API,
        source_record_id: `${state.code}|${offenceRef.id}|${year}`,
        crime_type: offenceLabel,
        severity_category: categoriseABS(offenceLabel),
        incident_count: Math.max(1, Math.round(obs.value)),
        lat: state.lat,
        lng: state.lng,
        incident_date: `${year}-01-01`,
        ...indexLatLng(state.lat, state.lng),
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

    this.logger.log(`[australia-abs] fetched=${fetched} inserted=${inserted}`);
    return { fetched, inserted, errors };
  }
}
