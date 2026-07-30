import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { indexLatLng } from '../lib/h3';
import { categoriseMX } from '../lib/normalise';
import { upsertIncidents, IncidentRow } from '../lib/upsert';
import { logPipelineRun } from '../lib/pipeline-log';

const SOURCE_API = 'mexico-hoyodecrimen';
const SOURCE_COUNTRY = 'MX';
const BASE = 'https://hoyodecrimen.com/api/v1';

const DEFAULT_CRIMES = [
  'HOMICIDIO DOLOSO',
  'ROBO DE VEHICULO CON VIOLENCIA',
  'ROBO A TRANSEUNTE EN VIA PUBLICA CON Y SIN VIOLENCIA',
  'ROBO A CASA HABITACION CON VIOLENCIA',
  'VIOLACION',
  'SECUESTRO',
];

@Injectable()
export class MexicoHoyodecrimenConnector {
  private readonly logger = new Logger(MexicoHoyodecrimenConnector.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<{ fetched: number; inserted: number; errors: string[] }> {
    let fetched = 0;
    let inserted = 0;
    const errors: string[] = [];

    let cuadrantes: any[];
    try {
      const res = await fetch(`${BASE}/cuadrantes`, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`hoyodecrimen cuadrantes HTTP ${res.status}`);
      const json = await res.json();
      cuadrantes = Array.isArray(json) ? json : (json as any).rows ?? [];
    } catch (err) {
      errors.push(`cuadrantes: ${(err as Error).message}`);
      await logPipelineRun(this.db, { source: SOURCE_API, recordsFetched: 0, recordsInserted: 0, errors: errors.join('; ') });
      return { fetched: 0, inserted: 0, errors };
    }

    const cap = Number(process.env.MX_MAX_CUADRANTES) || 200;
    const sample = cuadrantes.slice(0, cap);
    this.logger.log(`[mexico-hoyodecrimen] cuadrantes=${sample.length} crimes=${DEFAULT_CRIMES.length}`);

    const rows: IncidentRow[] = [];
    for (const c of sample) {
      const centroid = getCentroid(c);
      if (!centroid) continue;
      const cuadranteId = c.cuadrante || c.id;
      if (!cuadranteId) continue;

      for (const crime of DEFAULT_CRIMES) {
        try {
          const url = `${BASE}/cuadrantes/${encodeURIComponent(cuadranteId)}/crimes/${encodeURIComponent(crime)}/period`;
          const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const periods: any[] = Array.isArray(json) ? json : (json as any).rows ?? [];

          for (const p of periods) {
            fetched++;
            const count = Number(p.count ?? p.value ?? 0);
            if (!count || count <= 0) continue;
            const month = String(p.date || p.month || '').slice(0, 7);
            if (!/^\d{4}-\d{2}$/.test(month)) continue;

            rows.push({
              source_country: SOURCE_COUNTRY,
              source_api: SOURCE_API,
              source_record_id: `${cuadranteId}|${crime}|${month}`,
              crime_type: crime,
              severity_category: categoriseMX(crime),
              incident_count: Math.max(1, Math.round(count)),
              lat: centroid.lat,
              lng: centroid.lng,
              incident_date: `${month}-01`,
              ...indexLatLng(centroid.lat, centroid.lng),
            });
          }
        } catch (err) {
          errors.push(`${cuadranteId}/${crime}: ${(err as Error).message}`);
        }
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

    this.logger.log(`[mexico-hoyodecrimen] fetched=${fetched} inserted=${inserted}`);
    return { fetched, inserted, errors };
  }
}

function getCentroid(c: any): { lat: number; lng: number } | null {
  if (typeof c.lat === 'number' && typeof c.lng === 'number') return { lat: c.lat, lng: c.lng };
  if (c.geometry?.type === 'Polygon') {
    const ring: number[][] = c.geometry.coordinates[0] ?? [];
    if (!ring.length) return null;
    let sumLat = 0, sumLng = 0;
    for (const [lng, lat] of ring) { sumLng += lng; sumLat += lat; }
    return { lat: sumLat / ring.length, lng: sumLng / ring.length };
  }
  return null;
}
