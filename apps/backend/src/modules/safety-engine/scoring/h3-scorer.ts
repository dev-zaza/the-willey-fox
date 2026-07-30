import { Injectable, Logger, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { sql } from 'drizzle-orm';
import { COUNTRIES } from '../data/country-data';

const logger = new Logger('H3Scorer');

function isDryRun(): boolean {
  return process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
}

// Numbeo Safety Index by city (100 − Crime Index). Refreshed Apr 2026.
// Higher = safer.
const NUMBEO_CITY_SCORES: Record<string, number> = {
  london: 44.7,
  manchester: 35.2,
  birmingham: 38.1,
  liverpool: 41.0,
  leeds: 48.3,
  bristol: 52.1,
  newcastle: 50.4,
  cardiff: 46.8,
  belfast: 49.1,
  brighton: 55.2,
  sheffield: 43.5,
  edinburgh: 58.3,
  glasgow: 39.7,
  nottingham: 36.4,
  leicester: 42.1,
  coventry: 44.0,
  oxford: 57.2,
  cambridge: 61.4,
  york: 63.8,
  exeter: 62.0,
};

// Country-level fallback Numbeo scores (100 − Crime Index)
const NUMBEO_COUNTRY_FALLBACK: Record<string, number> = {
  GB: 50.0,
  US: 46.0,
  DE: 62.0,
  FR: 52.0,
  AU: 58.0,
  CA: 61.0,
};

function buildCountryPopValues(): string {
  return Object.entries(COUNTRIES)
    .map(([iso, c]) => `('${iso}', ${c.population})`)
    .join(', ');
}

// WF 5-band thresholds (applied to safety score = 100 - danger score)
const SCORE_SQL_TEMPLATE = `
WITH country_pop(country, population) AS (
  VALUES %COUNTRY_POPS%
),
severity_weight(category, weight) AS (
  VALUES ('violent', 3), ('sexual', 4), ('property', 1), ('asb', 1)
),
incidents_long AS (
  SELECT source_country, h3_index_r7 AS h3, 7::smallint AS resolution,
         incident_count, severity_category, incident_date
  FROM crime_incidents WHERE h3_index_r7 IS NOT NULL
  UNION ALL
  SELECT source_country, h3_index_r9, 9::smallint,
         incident_count, severity_category, incident_date
  FROM crime_incidents WHERE h3_index_r9 IS NOT NULL
  UNION ALL
  SELECT source_country, h3_index_r11, 11::smallint,
         incident_count, severity_category, incident_date
  FROM crime_incidents WHERE h3_index_r11 IS NOT NULL
),
cell_metrics AS (
  SELECT i.source_country, i.h3, i.resolution,
         SUM(i.incident_count)::numeric AS volume,
         SUM(i.incident_count * s.weight)::numeric AS severity_weighted,
         SUM(i.incident_count * (
           CASE
             WHEN i.incident_date IS NULL THEN 0
             WHEN CURRENT_DATE - i.incident_date::date <= 90 THEN 2
             WHEN CURRENT_DATE - i.incident_date::date <= 365 THEN 1
             WHEN CURRENT_DATE - i.incident_date::date <= 365 * 3 THEN 0.5
             ELSE 0
           END
         ))::numeric AS recency_weighted
  FROM incidents_long i
  JOIN severity_weight s ON s.category = i.severity_category
  WHERE ($1::text IS NULL OR i.source_country = $1)
  GROUP BY i.source_country, i.h3, i.resolution
),
with_pop AS (
  SELECT cm.*, (cm.volume / cp.population::numeric) * 100000 AS population_normalised
  FROM cell_metrics cm
  JOIN country_pop cp ON cp.country = cm.source_country
),
normalised AS (
  SELECT w.*,
    CASE WHEN MAX(w.volume) OVER part = MIN(w.volume) OVER part THEN 0
         ELSE (w.volume - MIN(w.volume) OVER part) * 100
              / NULLIF(MAX(w.volume) OVER part - MIN(w.volume) OVER part, 0) END AS v_norm,
    CASE WHEN MAX(w.severity_weighted) OVER part = MIN(w.severity_weighted) OVER part THEN 0
         ELSE (w.severity_weighted - MIN(w.severity_weighted) OVER part) * 100
              / NULLIF(MAX(w.severity_weighted) OVER part - MIN(w.severity_weighted) OVER part, 0) END AS s_norm,
    CASE WHEN MAX(w.recency_weighted) OVER part = MIN(w.recency_weighted) OVER part THEN 0
         ELSE (w.recency_weighted - MIN(w.recency_weighted) OVER part) * 100
              / NULLIF(MAX(w.recency_weighted) OVER part - MIN(w.recency_weighted) OVER part, 0) END AS r_norm,
    CASE WHEN MAX(w.population_normalised) OVER part = MIN(w.population_normalised) OVER part THEN 0
         ELSE (w.population_normalised - MIN(w.population_normalised) OVER part) * 100
              / NULLIF(MAX(w.population_normalised) OVER part - MIN(w.population_normalised) OVER part, 0) END AS p_norm
  FROM with_pop w
  WINDOW part AS (PARTITION BY w.source_country, w.resolution)
),
scored AS (
  SELECT source_country, h3, resolution, volume,
         -- danger score 0-100 (higher = more dangerous)
         (0.30 * v_norm + 0.35 * s_norm + 0.20 * r_norm + 0.15 * p_norm)::numeric AS danger_score
  FROM normalised
),
banded AS (
  SELECT s.source_country, s.h3, s.resolution, s.volume,
         s.danger_score,
         -- safety score = invert danger; WF 5-band thresholds
         (100 - s.danger_score)::numeric AS safety_score,
         CASE
           WHEN s.volume < 3 THEN 'low_count'
           WHEN (100 - s.danger_score) >= 80 THEN 'band5'
           WHEN (100 - s.danger_score) >= 60 THEN 'band4'
           WHEN (100 - s.danger_score) >= 40 THEN 'band3'
           WHEN (100 - s.danger_score) >= 20 THEN 'band2'
           ELSE 'band1'
         END AS band
  FROM scored s
)
INSERT INTO h3_safety_scores (h3_index, resolution, score, band, source_country, last_calculated_at)
SELECT h3, resolution, ROUND(safety_score, 2), band, source_country, NOW()
FROM banded
ON CONFLICT (h3_index, resolution) DO UPDATE SET
  score = EXCLUDED.score,
  band = EXCLUDED.band,
  source_country = EXCLUDED.source_country,
  last_calculated_at = EXCLUDED.last_calculated_at
`;

@Injectable()
export class H3Scorer {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // Blend police score (0-100 safety) with Numbeo city index: 0.70 × P + 0.30 × N
  blendWithNumbeo(policeScore: number, cityName: string, countryIso: string): number {
    const key = cityName.toLowerCase().trim();
    const numbeo = NUMBEO_CITY_SCORES[key] ?? NUMBEO_COUNTRY_FALLBACK[countryIso] ?? 50.0;
    return Math.round((0.70 * policeScore + 0.30 * numbeo) * 10) / 10;
  }

  async scoreCountry(country: string): Promise<{ country: string; cells: number }> {
    if (isDryRun()) {
      logger.debug(`[dry-run] would score country=${country}`);
      return { country, cells: 0 };
    }

    const text = SCORE_SQL_TEMPLATE.replace('%COUNTRY_POPS%', buildCountryPopValues());
    await (this.db as any).$client.unsafe(text, [country]);

    const rows = await this.db.execute(
      sql`SELECT COUNT(*)::int AS cells FROM h3_safety_scores WHERE source_country = ${country}`,
    );
    const cells = (rows as any[])[0]?.cells ?? 0;
    logger.log(`[scoring] ${country}: ${cells} cells in h3_safety_scores`);
    return { country, cells };
  }

  async scoreAll(): Promise<Array<{ country: string; cells: number }>> {
    if (isDryRun()) {
      logger.debug('[dry-run] would score all countries');
      return [];
    }

    const text = SCORE_SQL_TEMPLATE.replace('%COUNTRY_POPS%', buildCountryPopValues());
    await (this.db as any).$client.unsafe(text, [null]);

    const rawRows = await this.db.execute(
      sql`SELECT source_country AS country, COUNT(*)::int AS cells
          FROM h3_safety_scores GROUP BY source_country ORDER BY source_country`,
    );
    const rows = rawRows as unknown as Array<{ country: string; cells: number }>;
    for (const r of rows) logger.log(`[scoring] ${r.country}: ${r.cells} cells`);
    return rows;
  }
}
