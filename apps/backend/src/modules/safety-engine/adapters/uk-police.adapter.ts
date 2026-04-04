import { Injectable, Logger } from '@nestjs/common';
import { ICrimeDataAdapter, SafetyZoneInput, NormalizedCrimeData } from './adapter.interface';

// Representative UK city centre coordinates for baseline ingestion
// In production, expand to all 43 police forces using their neighbourhood data
const UK_SAMPLE_LOCATIONS = [
  { region: 'GB-LON', name: 'London City Centre', lat: 51.5074, lng: -0.1278 },
  { region: 'GB-MCR', name: 'Manchester City Centre', lat: 53.4808, lng: -2.2426 },
  { region: 'GB-BIR', name: 'Birmingham City Centre', lat: 52.4862, lng: -1.8904 },
  { region: 'GB-LDS', name: 'Leeds City Centre', lat: 53.8008, lng: -1.5491 },
  { region: 'GB-EDI', name: 'Edinburgh', lat: 55.9533, lng: -3.1883 },
  { region: 'GB-BRS', name: 'Bristol', lat: 51.4545, lng: -2.5879 },
];

// UK Police API crime category → internal category mapping
const CATEGORY_MAP: Record<string, string> = {
  'violent-crime': 'assault',
  'robbery': 'robbery',
  'theft-from-the-person': 'theft',
  'burglary': 'burglary',
  'vehicle-crime': 'theft',
  'drugs': 'drug_offences',
  'public-order': 'assault',
  'criminal-damage-arson': 'arson',
  'other-theft': 'theft',
  'shoplifting': 'theft',
  'possession-of-weapons': 'assault',
  'sexual-offences': 'sexual_violence',
  'anti-social-behaviour': 'other',
};

@Injectable()
export class UkPoliceAdapter implements ICrimeDataAdapter {
  readonly sourceName = 'uk_police';
  private readonly logger = new Logger(UkPoliceAdapter.name);
  private readonly baseUrl = 'https://data.police.uk/api';

  async ingest(): Promise<SafetyZoneInput[]> {
    const results: SafetyZoneInput[] = [];
    const date = this.getLatestAvailableMonth();

    for (const location of UK_SAMPLE_LOCATIONS) {
      try {
        const url = `${this.baseUrl}/crimes-street/all-crime?lat=${location.lat}&lng=${location.lng}&date=${date}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          this.logger.warn(`UK Police API returned ${response.status} for ${location.name}`);
          continue;
        }

        const crimes = (await response.json()) as Array<{
          category: string;
          location: { latitude: string; longitude: string };
        }>;

        const categoryCounts = this.aggregateCategories(crimes.map(c => c.category));

        results.push({
          source: this.sourceName,
          sourceRegion: location.region,
          sourceGranularity: 'street',
          centerLat: location.lat,
          centerLng: location.lng,
          radiusMetres: 1609, // 1 mile radius (API default)
          crimeData: categoryCounts,
          periodStart: new Date(`${date}-01`),
          periodEnd: new Date(`${date}-01`),
        });

        this.logger.debug(`Ingested ${crimes.length} crimes for ${location.name}`);
      } catch (err) {
        this.logger.error(`Failed to fetch UK Police data for ${location.name}: ${(err as Error).message}`);
      }
    }

    return results;
  }

  private aggregateCategories(categories: string[]): NormalizedCrimeData[] {
    const counts: Record<string, number> = {};

    for (const cat of categories) {
      const mapped = CATEGORY_MAP[cat] ?? 'other';
      counts[mapped] = (counts[mapped] ?? 0) + 1;
    }

    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  }

  /**
   * UK Police API has ~2 month lag. Return 2 months ago in YYYY-MM format.
   */
  private getLatestAvailableMonth(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
