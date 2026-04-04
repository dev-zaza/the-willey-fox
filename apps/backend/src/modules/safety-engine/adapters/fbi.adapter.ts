import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ICrimeDataAdapter, SafetyZoneInput, NormalizedCrimeData } from './adapter.interface';

// Major US cities with approximate bounding boxes for city-level zones
const US_CITIES = [
  { region: 'US-IL-CHI', name: 'Chicago', ori: 'IL0100100', minLat: 41.64, minLng: -87.94, maxLat: 42.02, maxLng: -87.52 },
  { region: 'US-NY-NYC', name: 'New York City', ori: 'NY0303000', minLat: 40.50, minLng: -74.26, maxLat: 40.92, maxLng: -73.70 },
  { region: 'US-CA-LA', name: 'Los Angeles', ori: 'CA0194200', minLat: 33.70, minLng: -118.67, maxLat: 34.34, maxLng: -118.15 },
  { region: 'US-TX-HOU', name: 'Houston', ori: 'TX2200000', minLat: 29.52, minLng: -95.77, maxLat: 30.11, maxLng: -95.01 },
  { region: 'US-AZ-PHX', name: 'Phoenix', ori: 'AZ0040100', minLat: 33.29, minLng: -112.32, maxLat: 33.92, maxLng: -111.93 },
];

// FBI NIBRS offense type → internal category mapping
const FBI_OFFENSE_MAP: Record<string, string> = {
  'murder_and_nonnegligent_manslaughter': 'homicide',
  'negligent_manslaughter': 'homicide',
  'rape': 'sexual_violence',
  'sodomy': 'sexual_violence',
  'robbery': 'robbery',
  'aggravated_assault': 'assault',
  'simple_assault': 'assault',
  'burglary': 'burglary',
  'larceny_theft': 'theft',
  'motor_vehicle_theft': 'theft',
  'arson': 'arson',
  'drug_narcotics': 'drug_offences',
  'drug_equipment': 'drug_offences',
};

@Injectable()
export class FbiAdapter implements ICrimeDataAdapter {
  readonly sourceName = 'fbi';
  private readonly logger = new Logger(FbiAdapter.name);
  constructor(private readonly configService: ConfigService) {}

  async ingest(): Promise<SafetyZoneInput[]> {
    const apiKey = this.configService.get<string>('FBI_API_KEY');

    if (!apiKey) {
      this.logger.warn('FBI_API_KEY not set — skipping FBI ingestion. Add FBI_API_KEY to .env to enable.');
      return [];
    }

    const results: SafetyZoneInput[] = [];
    const year = new Date().getFullYear() - 2; // FBI data is ~2 years behind

    for (const city of US_CITIES) {
      try {
        const url = `https://api.usa.gov/crime/fbi/cde/summarized/agency/${city.ori}/offenses/${year}/${year}?API_KEY=${apiKey}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });

        if (!response.ok) {
          this.logger.warn(`FBI API returned ${response.status} for ${city.name}`);
          continue;
        }

        const data = await response.json() as FbiResponse;
        const crimeData = this.normalizeOffenses(data);

        if (crimeData.length === 0) continue;

        results.push({
          source: this.sourceName,
          sourceRegion: city.region,
          sourceGranularity: 'city',
          bboxMinLat: city.minLat,
          bboxMinLng: city.minLng,
          bboxMaxLat: city.maxLat,
          bboxMaxLng: city.maxLng,
          crimeData,
          periodStart: new Date(`${year}-01-01`),
          periodEnd: new Date(`${year}-12-31`),
        });

        this.logger.debug(`Ingested FBI data for ${city.name} (${year})`);
      } catch (err) {
        this.logger.error(`Failed to fetch FBI data for ${city.name}: ${(err as Error).message}`);
      }
    }

    return results;
  }

  private normalizeOffenses(data: FbiResponse): NormalizedCrimeData[] {
    const crimeData: NormalizedCrimeData[] = [];
    const results = data.results ?? [];

    for (const offense of results) {
      const category = FBI_OFFENSE_MAP[offense.offense?.toLowerCase().replace(/\s+/g, '_') ?? ''];
      if (!category) continue;

      const existing = crimeData.find(c => c.category === category);
      const count = offense.actual ?? 0;

      if (existing) {
        existing.count = (existing.count ?? 0) + count;
      } else {
        crimeData.push({ category, count });
      }
    }

    return crimeData;
  }
}

interface FbiResponse {
  results?: Array<{
    offense: string;
    actual: number;
  }>;
}
