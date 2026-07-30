import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { indexLatLng } from '../lib/h3';
import { upsertIncidents, IncidentRow } from '../lib/upsert';
import { logPipelineRun } from '../lib/pipeline-log';
import { COUNTRIES } from '../data/country-data';

const SOURCE_API = 'unodc-global';
const DEFAULT_URL =
  'https://dataunodc.un.org/sites/dataunodc.un.org/files/data_cts_intentional_homicide.csv';

const NAME_TO_ISO: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRIES).map(([iso, c]) => [c.name.toLowerCase(), iso]),
);
const NAME_ALIASES: Record<string, string> = {
  'united states of america': 'US',
  'russian federation': 'RU',
  'republic of korea': 'KR',
  'czech republic': 'CZ',
  'iran (islamic republic of)': 'IR',
  'viet nam': 'VN',
  'syrian arab republic': 'SY',
  'united republic of tanzania': 'TZ',
};

function lookupIso(name: string | undefined): string | null {
  if (!name) return null;
  const lower = String(name).trim().toLowerCase();
  return NAME_ALIASES[lower] ?? NAME_TO_ISO[lower] ?? null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body
    .filter((r) => r.length === keys.length)
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]])));
}

@Injectable()
export class UnodcGlobalConnector {
  private readonly logger = new Logger(UnodcGlobalConnector.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async run(): Promise<{ fetched: number; inserted: number; errors: string[] }> {
    const target =
      this.configService.get<string>('UNODC_HOMICIDE_URL') ?? DEFAULT_URL;
    let fetched = 0;
    let inserted = 0;
    const errors: string[] = [];

    let csvText: string;
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`UNODC HTTP ${res.status}`);
      csvText = await res.text();
    } catch (err) {
      errors.push(`fetch: ${(err as Error).message}`);
      await logPipelineRun(this.db, { source: SOURCE_API, recordsFetched: 0, recordsInserted: 0, errors: errors.join('; ') });
      return { fetched: 0, inserted: 0, errors };
    }

    const records = rowsToObjects(parseCsv(csvText));
    const rows: IncidentRow[] = [];

    for (const rec of records) {
      fetched++;
      const indicator = (rec.Indicator ?? rec.indicator ?? '').toLowerCase();
      if (!indicator.includes('homicide')) continue;

      const unit = (rec.Unit ?? rec.unit ?? '').toLowerCase();
      if (!unit.includes('count') && !unit.includes('number')) continue;

      const iso = lookupIso(rec.Country ?? rec.country);
      if (!iso) continue;
      const centroid = COUNTRIES[iso];
      if (!centroid) continue;

      const year = Number(rec.Year ?? rec.year);
      if (!Number.isFinite(year)) continue;

      const value = Number(rec.Value ?? rec.value);
      if (!Number.isFinite(value) || value <= 0) continue;

      rows.push({
        source_country: iso,
        source_api: SOURCE_API,
        source_record_id: `${iso}|homicide|${year}`,
        crime_type: 'intentional-homicide',
        severity_category: 'violent',
        incident_count: Math.max(1, Math.round(value)),
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

    this.logger.log(`[unodc-global] fetched=${fetched} inserted=${inserted}`);
    return { fetched, inserted, errors };
  }
}
