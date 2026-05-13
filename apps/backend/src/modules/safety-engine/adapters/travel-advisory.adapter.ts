import { Injectable, Logger } from '@nestjs/common';
import { ICrimeDataAdapter, SafetyZoneInput, NormalizedCrimeData } from './adapter.interface';
import * as advisoryData from '../data/us-travel-advisories.json';
import { COUNTRY_BBOXES } from '../data/country-bboxes';

/**
 * Travel Advisory Adapter — ingests US State Department travel advisory data.
 *
 * Data source: US_travel_advisories_by_country.xlsx (222 countries)
 * Levels: 1 (Normal Precautions) → 4 (Do Not Travel)
 * Risk indicators: Crime, Terrorism, Civil Unrest, Health, Natural Disaster,
 *                  Time-limited Event, Kidnapping, Wrongful Detention, Other
 *
 * Converts advisory levels to NormalizedCrimeData for the ZoneScorer:
 * - Level 1 → score ~90 (safe)
 * - Level 2 → score ~60 (caution)
 * - Level 3 → score ~30 (reconsider)
 * - Level 4 → score ~10 (do not travel)
 */

interface AdvisoryEntry {
  country: string;
  level: number | null;
  advisory: string;
  dateIssued: string;
  riskIndicators: string | null;
  crime: boolean;
  terrorism: boolean;
  civilUnrest: boolean;
  health: boolean;
  naturalDisaster: boolean;
  timeLimitedEvent: boolean;
  kidnapping: boolean;
  wrongfulDetention: boolean;
  other: boolean;
}

/** Map advisory level (1-4) to a synthetic crime rate for ZoneScorer */
const LEVEL_TO_RATE: Record<number, number> = {
  1: 10,   // low — ZoneScorer will produce high score
  2: 100,  // moderate
  3: 300,  // high
  4: 600,  // extreme
};

const RISK_CATEGORIES = [
  { key: 'crime', label: 'Crime' },
  { key: 'terrorism', label: 'Terrorism' },
  { key: 'civilUnrest', label: 'Civil Unrest' },
  { key: 'health', label: 'Health' },
  { key: 'naturalDisaster', label: 'Natural Disaster' },
  { key: 'timeLimitedEvent', label: 'Time-limited Event' },
  { key: 'kidnapping', label: 'Kidnapping' },
  { key: 'wrongfulDetention', label: 'Wrongful Detention' },
  { key: 'other', label: 'Other' },
] as const;

@Injectable()
export class TravelAdvisoryAdapter implements ICrimeDataAdapter {
  readonly sourceName = 'us_travel_advisory';
  private readonly logger = new Logger(TravelAdvisoryAdapter.name);

  async ingest(): Promise<SafetyZoneInput[]> {
    const entries = advisoryData as unknown as AdvisoryEntry[];
    const zones: SafetyZoneInput[] = [];

    for (const entry of entries) {
      if (!entry.level || !entry.country) continue;

      const bbox = COUNTRY_BBOXES[entry.country];
      if (!bbox) {
        this.logger.warn(`No bbox for country: ${entry.country}, skipping`);
        continue;
      }

      const crimeData = this.buildCrimeData(entry);
      const now = new Date();

      zones.push({
        source: 'us_travel_advisory',
        sourceRegion: entry.country,
        sourceGranularity: 'country',
        bboxMinLat: bbox.minLat,
        bboxMinLng: bbox.minLng,
        bboxMaxLat: bbox.maxLat,
        bboxMaxLng: bbox.maxLng,
        crimeData,
        periodStart: this.parseDate(entry.dateIssued) ?? now,
        periodEnd: now,
      });
    }

    this.logger.log(`Parsed ${zones.length} travel advisory zones`);
    return zones;
  }

  private buildCrimeData(entry: AdvisoryEntry): NormalizedCrimeData[] {
    const rate = LEVEL_TO_RATE[entry.level!] ?? 100;
    const data: NormalizedCrimeData[] = [
      {
        category: `advisory_level_${entry.level}`,
        ratePerHundredK: rate,
        count: entry.level!,
      },
    ];

    // Add individual risk indicators as categories
    for (const { key, label } of RISK_CATEGORIES) {
      if ((entry as any)[key]) {
        data.push({
          category: label.toLowerCase().replace(/\s+/g, '_'),
          count: 1,
          ratePerHundredK: rate * 0.3, // each indicator contributes partial weight
        });
      }
    }

    return data;
  }

  private parseDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    // Format: MM/DD/YYYY
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    return new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
  }
}
