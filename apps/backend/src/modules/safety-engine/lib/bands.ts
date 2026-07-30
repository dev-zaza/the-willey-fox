// 5-band WF-mapping palette — higher band = safer
export type Band = 'band5' | 'band4' | 'band3' | 'band2' | 'band1' | 'low_count';

export const BAND_COLOURS: Record<Band, string> = {
  band5:     '#3FA34D', // Safe (80–100)
  band4:     '#A4C957', // Low risk (60–79)
  band3:     '#FFC857', // Stay aware (40–59)
  band2:     '#F46036', // Elevated (20–39)
  band1:     '#D7263D', // High caution (0–19)
  low_count: '#9ED2B2', // < 3 incidents — no safety claim
};

export const BAND_LABELS: Record<Band, string> = {
  band5:     'Safe',
  band4:     'Low Risk',
  band3:     'Stay Aware',
  band2:     'Elevated',
  band1:     'High Caution',
  low_count: 'Low Data',
};

// Legacy band values from old scorer — map to nearest WF colour
const LEGACY_COLOURS: Record<string, string> = {
  green:  '#3FA34D',
  amber:  '#FFC857',
  red:    '#D7263D',
  purple: '#D7263D',
};

export function colourFor(band: string): string {
  return BAND_COLOURS[band as Band] ?? LEGACY_COLOURS[band] ?? '#888888';
}

export function labelFor(band: string): string {
  return BAND_LABELS[band as Band] ?? 'Unknown';
}

// Map percentile-based score (0–100, higher = more dangerous) → WF safety band
// score here = danger score from h3-scorer; invert for safety display
export function bandFromDangerScore(dangerScore: number, incidentCount: number): Band {
  if (incidentCount < 3) return 'low_count';
  const safety = 100 - dangerScore;
  if (safety >= 80) return 'band5';
  if (safety >= 60) return 'band4';
  if (safety >= 40) return 'band3';
  if (safety >= 20) return 'band2';
  return 'band1';
}
