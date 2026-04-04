export interface NormalizedCrimeData {
  category: string;
  count?: number;
  ratePerHundredK?: number;
}

export interface SafetyZoneInput {
  source: string;
  sourceRegion: string;
  sourceGranularity: 'street' | 'neighbourhood' | 'city' | 'country';

  // Point + radius (used for UK Police street-level)
  centerLat?: number;
  centerLng?: number;
  radiusMetres?: number;

  // Bounding box (used for city/country-level)
  bboxMinLat?: number;
  bboxMinLng?: number;
  bboxMaxLat?: number;
  bboxMaxLng?: number;

  crimeData: NormalizedCrimeData[];
  periodStart: Date;
  periodEnd: Date;
}

export interface ICrimeDataAdapter {
  readonly sourceName: string;
  ingest(): Promise<SafetyZoneInput[]>;
}
