import { Logger } from '@nestjs/common';
import type { DrizzleDB } from '../../../database/database.module';

export interface IncidentRow {
  source_country: string;
  source_api: string;
  source_record_id: string;
  crime_type: string;
  severity_category: string;
  incident_count: number;
  lat: number;
  lng: number;
  h3_index_r7: string | null;
  h3_index_r9: string | null;
  h3_index_r11: string | null;
  incident_date: string | null;
}

const COLUMNS = [
  'source_country', 'source_api', 'source_record_id', 'crime_type',
  'severity_category', 'incident_count', 'lat', 'lng',
  'h3_index_r7', 'h3_index_r9', 'h3_index_r11', 'incident_date',
] as const;

const DEFAULT_BATCH = 500;
const logger = new Logger('upsertIncidents');

function isDryRun(): boolean {
  return process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
}

function buildUpsertSql(rows: IncidentRow[]): { text: string; values: unknown[] } {
  const placeholders: string[] = [];
  const values: unknown[] = [];

  rows.forEach((row, i) => {
    const base = i * COLUMNS.length;
    const tuple = COLUMNS.map((_, c) => `$${base + c + 1}`).join(', ');
    placeholders.push(`(${tuple})`);
    COLUMNS.forEach((col) => values.push((row as any)[col] ?? null));
  });

  const text = `
    INSERT INTO crime_incidents (${COLUMNS.join(', ')})
    VALUES ${placeholders.join(', \n')}
    ON CONFLICT (source_api, source_record_id) DO UPDATE SET
      crime_type = EXCLUDED.crime_type,
      severity_category = EXCLUDED.severity_category,
      incident_count = EXCLUDED.incident_count,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      h3_index_r7 = EXCLUDED.h3_index_r7,
      h3_index_r9 = EXCLUDED.h3_index_r9,
      h3_index_r11 = EXCLUDED.h3_index_r11,
      incident_date = EXCLUDED.incident_date,
      ingested_at = now()
  `;

  return { text, values };
}

export async function upsertIncidents(
  db: DrizzleDB,
  rows: IncidentRow[],
  options: { batchSize?: number } = {},
): Promise<number> {
  if (!rows.length) return 0;

  if (isDryRun()) {
    logger.debug(`[dry-run] would upsert ${rows.length} rows; sample: ${JSON.stringify(rows[0])}`);
    return rows.length;
  }

  // Dedupe within the incoming set — Postgres ON CONFLICT cannot update the
  // same row twice in one statement when a batch contains duplicate conflict keys.
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const key = `${r.source_api}|${r.source_record_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  let inserted = 0;

  for (let i = 0; i < deduped.length; i += batchSize) {
    const batch = deduped.slice(i, i + batchSize);
    const { text, values } = buildUpsertSql(batch);
    await (db as any).$client.unsafe(text, values);
    inserted += batch.length;
  }

  return inserted;
}
