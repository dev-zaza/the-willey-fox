import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { ICrimeDataAdapter, SafetyZoneInput } from './adapter.interface';
import { indexLatLng } from '../lib/h3';
import { categoriseFBI } from '../lib/normalise';
import { upsertIncidents, IncidentRow } from '../lib/upsert';
import { logPipelineRun } from '../lib/pipeline-log';

const SOURCE_API = 'fbi';
const SOURCE_COUNTRY = 'US';
const BASE_URL = 'https://api.usa.gov/crime/fbi/cde';
const BATCH_SIZE = 500;

const DEFAULT_STATES = ['NY', 'CA', 'TX', 'IL', 'AZ', 'FL', 'PA', 'OH'];
const AGENCIES_PER_STATE = 25;

function currentYearWindow(): number[] {
  const y = new Date().getUTCFullYear();
  return [y - 2, y - 1];
}

@Injectable()
export class FbiAdapter implements ICrimeDataAdapter {
  readonly sourceName = SOURCE_API;
  private readonly logger = new Logger(FbiAdapter.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async ingest(): Promise<SafetyZoneInput[]> {
    const apiKey = this.configService.get<string>('FBI_API_KEY');
    if (!apiKey) {
      this.logger.warn('FBI_API_KEY not set — skipping FBI ingestion');
      return [];
    }

    const targetStates = (process.env.US_STATES ?? DEFAULT_STATES.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
    const targetYears = currentYearWindow();

    let fetched = 0;
    let inserted = 0;
    const errors: string[] = [];
    const rows: IncidentRow[] = [];

    for (const state of targetStates) {
      let agencies: Agency[];
      try {
        agencies = await this.listAgencies(state, apiKey);
      } catch (err) {
        const msg = `agencies ${state}: ${(err as Error).message}`;
        this.logger.error(msg);
        errors.push(msg);
        continue;
      }

      for (const agency of agencies) {
        for (const year of targetYears) {
          try {
            const payload = await this.agencyOffenses(agency.ori, year, apiKey);
            const totals = extractOffenseTotals(payload);
            fetched += totals.length;

            for (const t of totals) {
              const lat = Number(agency.latitude);
              const lng = Number(agency.longitude);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
              rows.push({
                source_country: SOURCE_COUNTRY,
                source_api: SOURCE_API,
                source_record_id: `${agency.ori}|${t.offense}|${year}`,
                crime_type: t.offense,
                severity_category: categoriseFBI(t.offense),
                incident_count: Math.max(1, Math.round(t.count)),
                lat,
                lng,
                incident_date: `${year}-01-01`,
                ...indexLatLng(lat, lng),
              });
            }
          } catch (err) {
            const msg = `${agency.ori} ${year}: ${(err as Error).message}`;
            this.logger.error(msg);
            errors.push(msg);
          }
        }
      }
      this.logger.debug(`${state}: ${agencies.length} agencies processed`);
    }

    try {
      inserted = await upsertIncidents(this.db, rows, { batchSize: BATCH_SIZE });
    } catch (err) {
      errors.push(`upsert: ${(err as Error).message}`);
    }

    await logPipelineRun(this.db, {
      source: SOURCE_API,
      recordsFetched: fetched,
      recordsInserted: inserted,
      errors: errors.length ? errors.join('; ') : null,
    });

    this.logger.log(`FBI ingestion complete: fetched=${fetched} inserted=${inserted}`);
    return [];
  }

  private async listAgencies(state: string, apiKey: string): Promise<Agency[]> {
    const url = `${BASE_URL}/agencies/byStateAbbr/${state}?API_KEY=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`FBI agencies ${state} → HTTP ${res.status}`);
    const json = await res.json() as Agency[] | { results?: Agency[] };
    const list = Array.isArray(json) ? json : (json as any).results ?? [];
    return (list as Agency[])
      .filter((a) => a.latitude && a.longitude)
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .slice(0, AGENCIES_PER_STATE);
  }

  private async agencyOffenses(ori: string, year: number, apiKey: string): Promise<unknown> {
    const url = `${BASE_URL}/summarized/agencies/${ori}/offenses/${year}/${year}?API_KEY=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`FBI offenses ${ori} ${year} → HTTP ${res.status}`);
    return res.json();
  }
}

interface Agency {
  ori: string;
  latitude: string | number;
  longitude: string | number;
  population?: number;
}

function extractOffenseTotals(payload: unknown): Array<{ offense: string; count: number }> {
  const out: Array<{ offense: string; count: number }> = [];
  if (payload && typeof (payload as any).offenses === 'object' && !Array.isArray((payload as any).offenses)) {
    for (const [offense, count] of Object.entries((payload as any).offenses)) {
      const n = Number(count);
      if (Number.isFinite(n) && n > 0) out.push({ offense, count: n });
    }
    return out;
  }
  const rows = Array.isArray(payload) ? payload : (payload as any)?.results ?? [];
  for (const r of rows) {
    const offense = r.offense || r.key || r.crime_type;
    const count = Number(r.actual ?? r.value ?? r.count ?? 0);
    if (offense && Number.isFinite(count) && count > 0) out.push({ offense, count });
  }
  return out;
}
