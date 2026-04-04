import { Injectable, Logger } from '@nestjs/common';
import { ICrimeDataAdapter, SafetyZoneInput, NormalizedCrimeData } from './adapter.interface';

// ICCS codes → internal category + weight relevance
// Only physical-safety-relevant categories included (IGNORE = excluded)
const ICCS_CATEGORY_MAP: Record<string, string> = {
  ICCS0101: 'homicide',
  ICCS0102: 'homicide',
  ICCS0301: 'assault',
  ICCS03011: 'assault',
  ICCS03012: 'assault',
  ICCS0401: 'robbery',
  ICCS0501: 'theft',
  ICCS05012: 'theft',
  ICCS0502: 'burglary',
  ICCS030221: 'sexual_violence',
  ICCS0601: 'sexual_violence',
  ICCS0701: 'drug_offences',
  ICCS07031: 'drug_offences',
  ICCS07041: 'drug_offences',
  ICCS0903: 'arson',
  ICCS020111: 'dangerous_driving',
  ICCS020221: 'dangerous_driving',
};

// Bounding boxes for European countries (approximate)
const EU_COUNTRY_BBOX: Record<string, { minLat: number; minLng: number; maxLat: number; maxLng: number }> = {
  DE: { minLat: 47.27, minLng: 5.87, maxLat: 55.06, maxLng: 15.04 },
  FR: { minLat: 41.33, minLng: -5.14, maxLat: 51.09, maxLng: 9.56 },
  IT: { minLat: 35.49, minLng: 6.62, maxLat: 47.09, maxLng: 18.52 },
  ES: { minLat: 35.94, minLng: -9.29, maxLat: 43.79, maxLng: 4.33 },
  PL: { minLat: 49.0, minLng: 14.07, maxLat: 54.84, maxLng: 24.15 },
  NL: { minLat: 50.75, minLng: 3.36, maxLat: 53.56, maxLng: 7.23 },
  BE: { minLat: 49.50, minLng: 2.55, maxLat: 51.50, maxLng: 6.41 },
  SE: { minLat: 55.34, minLng: 10.96, maxLat: 69.06, maxLng: 24.16 },
  AT: { minLat: 46.37, minLng: 9.53, maxLat: 49.02, maxLng: 17.16 },
  CH: { minLat: 45.82, minLng: 5.96, maxLat: 47.81, maxLng: 10.49 },
  PT: { minLat: 36.84, minLng: -9.52, maxLat: 42.15, maxLng: -6.19 },
  GR: { minLat: 34.80, minLng: 19.37, maxLat: 41.75, maxLng: 29.65 },
  CZ: { minLat: 48.55, minLng: 12.09, maxLat: 51.06, maxLng: 18.86 },
  HU: { minLat: 45.74, minLng: 16.11, maxLat: 48.58, maxLng: 22.90 },
  RO: { minLat: 43.62, minLng: 20.26, maxLat: 48.27, maxLng: 29.76 },
};

const EUROSTAT_DATASET = 'crim_off_cat';
const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data';

@Injectable()
export class EurostatAdapter implements ICrimeDataAdapter {
  readonly sourceName = 'eurostat';
  private readonly logger = new Logger(EurostatAdapter.name);

  async ingest(): Promise<SafetyZoneInput[]> {
    const results: SafetyZoneInput[] = [];

    try {
      // Fetch per-100k-inhabitants rates for all countries and all relevant ICCS codes
      const url = `${EUROSTAT_BASE}/${EUROSTAT_DATASET}?format=JSON&unit=P_HTHAB&startPeriod=2021&endPeriod=2023`;
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });

      if (!response.ok) {
        this.logger.error(`Eurostat API returned ${response.status}`);
        return results;
      }

      const data = await response.json() as EurostatResponse;
      const parsed = this.parseEurostatResponse(data);

      for (const [geoCode, iccsData] of Object.entries(parsed)) {
        const bbox = EU_COUNTRY_BBOX[geoCode];
        if (!bbox) continue; // Skip countries without bbox mapping

        const crimeData: NormalizedCrimeData[] = [];
        for (const [iccsCode, rate] of Object.entries(iccsData)) {
          const category = ICCS_CATEGORY_MAP[iccsCode];
          if (!category) continue;

          // Aggregate rates by internal category
          const existing = crimeData.find(c => c.category === category);
          if (existing) {
            existing.ratePerHundredK = (existing.ratePerHundredK ?? 0) + rate;
          } else {
            crimeData.push({ category, ratePerHundredK: rate });
          }
        }

        if (crimeData.length === 0) continue;

        results.push({
          source: this.sourceName,
          sourceRegion: geoCode,
          sourceGranularity: 'country',
          bboxMinLat: bbox.minLat,
          bboxMinLng: bbox.minLng,
          bboxMaxLat: bbox.maxLat,
          bboxMaxLng: bbox.maxLng,
          crimeData,
          periodStart: new Date('2023-01-01'),
          periodEnd: new Date('2023-12-31'),
        });
      }

      this.logger.log(`Eurostat: ingested data for ${results.length} countries`);
    } catch (err) {
      this.logger.error(`Eurostat ingestion failed: ${(err as Error).message}`);
    }

    return results;
  }

  private parseEurostatResponse(data: EurostatResponse): Record<string, Record<string, number>> {
    const result: Record<string, Record<string, number>> = {};

    try {
      const dimensions = data.dataset?.dimension ?? data.dimension;
      const values = data.dataset?.value ?? data.value ?? {};

      if (!dimensions) return result;

      // Build index arrays for each dimension
      const geoIndex = this.buildIndex(dimensions.geo?.category?.index ?? {});
      const iccsIndex = this.buildIndex(dimensions.iccs?.category?.index ?? {});
      const timeIndex = this.buildIndex(dimensions.time?.category?.index ?? {});

      const iccsSize = Object.keys(iccsIndex).length;
      const timeSize = Object.keys(timeIndex).length;

      // SDMX JSON linear index: geo * iccsSize * timeSize + iccs * timeSize + time
      for (const [linearIdx, value] of Object.entries(values)) {
        if (typeof value !== 'number') continue;

        const idx = Number(linearIdx);
        const geoPos = Math.floor(idx / (iccsSize * timeSize));
        const iccsPos = Math.floor((idx % (iccsSize * timeSize)) / timeSize);

        const geo = geoIndex[geoPos];
        const iccs = iccsIndex[iccsPos];

        if (!geo || !iccs) continue;

        if (!result[geo]) result[geo] = {};
        // Take the latest value (last time period overwrites earlier ones)
        result[geo][iccs] = value;
      }
    } catch (err) {
      this.logger.warn(`Failed to parse Eurostat response: ${(err as Error).message}`);
    }

    return result;
  }

  private buildIndex(indexObj: Record<string, number>): Record<number, string> {
    const reversed: Record<number, string> = {};
    for (const [key, pos] of Object.entries(indexObj)) {
      reversed[pos] = key;
    }
    return reversed;
  }
}

interface EurostatResponse {
  dataset?: {
    dimension?: Record<string, { category?: { index?: Record<string, number> } }>;
    value?: Record<string, number>;
  };
  dimension?: Record<string, { category?: { index?: Record<string, number> } }>;
  value?: Record<string, number>;
}
