import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { indexLatLng } from '../lib/h3';
import { categoriseACLED } from '../lib/normalise';
import { upsertIncidents, IncidentRow } from '../lib/upsert';
import { logPipelineRun } from '../lib/pipeline-log';

const SOURCE_API = 'acled-conflict';
const BASE = 'https://api.acleddata.com/acled/read';
const DEFAULT_COUNTRIES = ['Mexico', 'Nigeria', 'Ukraine'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class AcledConflictConnector {
  private readonly logger = new Logger(AcledConflictConnector.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async run(countries?: string[], sinceDays = 180): Promise<{ fetched: number; inserted: number; errors: string[] }> {
    const key = this.configService.get<string>('ACLED_API_KEY');
    const email = this.configService.get<string>('ACLED_EMAIL');

    if (!key || !email) {
      this.logger.warn('ACLED_API_KEY and ACLED_EMAIL must be set — skipping ACLED ingestion');
      return { fetched: 0, inserted: 0, errors: ['ACLED_API_KEY or ACLED_EMAIL missing'] };
    }

    const targetCountries =
      countries ??
      (process.env.ACLED_COUNTRIES ?? DEFAULT_COUNTRIES.join(',')).split(',').map((s) => s.trim()).filter(Boolean);

    const startDate = new Date(Date.now() - sinceDays * 86400000).toISOString().slice(0, 10);

    let fetched = 0;
    let inserted = 0;
    const errors: string[] = [];
    const rows: IncidentRow[] = [];

    this.logger.log(`[acled-conflict] countries=${targetCountries.join(',')} since=${startDate}`);

    for (const country of targetCountries) {
      let page = 1;
      while (true) {
        let batch: any[];
        try {
          const params = new URLSearchParams({
            key,
            email,
            limit: '5000',
            page: String(page),
            event_date: `${startDate}|${todayIso()}`,
            event_date_where: 'BETWEEN',
            country,
          });
          const res = await fetch(`${BASE}?${params.toString()}`, { signal: AbortSignal.timeout(60_000) });
          if (!res.ok) throw new Error(`ACLED HTTP ${res.status}`);
          const json = await res.json() as any;
          if (!json.success) throw new Error(`ACLED error: ${json.error?.message ?? 'unknown'}`);
          batch = json.data ?? [];
        } catch (err) {
          errors.push(`${country} p${page}: ${(err as Error).message}`);
          break;
        }

        for (const ev of batch) {
          fetched++;
          const lat = Number(ev.latitude);
          const lng = Number(ev.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          rows.push({
            source_country: String(country).slice(0, 12),
            source_api: SOURCE_API,
            source_record_id: `acled|${ev.data_id || ev.event_id_cnty}`,
            crime_type: ev.event_type,
            severity_category: categoriseACLED(ev.event_type),
            incident_count: Math.max(1, Number(ev.fatalities) || 1),
            lat,
            lng,
            incident_date: ev.event_date ?? null,
            ...indexLatLng(lat, lng),
          });
        }

        if (batch.length < 5000) break;
        page++;
      }
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

    this.logger.log(`[acled-conflict] fetched=${fetched} inserted=${inserted}`);
    return { fetched, inserted, errors };
  }
}
