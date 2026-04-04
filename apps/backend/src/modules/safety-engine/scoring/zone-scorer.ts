import { Injectable } from '@nestjs/common';
import { NormalizedCrimeData } from '../adapters/adapter.interface';

/**
 * Category weights for route/zone safety scoring.
 * Higher weight = more impact on reducing safety score.
 * Based on SAFETY_MAP_FEATURE_SPEC.md §3.4
 */
const CATEGORY_WEIGHTS: Record<string, number> = {
  homicide: 10,
  sexual_violence: 9,
  assault: 8,
  robbery: 8,
  dangerous_driving: 4,
  theft: 4,
  arson: 3,
  drug_offences: 3,
  burglary: 3,
  other: 1,
};

/**
 * Regional baselines — rawScore at which safetyScore = 0.
 * Derived from approximate max crime rates in high-crime areas.
 * Scores normalize against these baselines so they are comparable across regions.
 */
const REGIONAL_BASELINES: Record<string, number> = {
  street: 2000,       // UK Police: raw counts per 1-mile area
  neighbourhood: 1500,
  city: 5000,         // City-level: higher raw totals expected
  country: 8000,      // Country-level rate-per-100k aggregated
};

@Injectable()
export class ZoneScorer {
  /**
   * Compute a 0–100 safety score from normalized crime data.
   * 100 = completely safe, 0 = maximum danger.
   */
  score(crimeData: NormalizedCrimeData[], granularity: string): number {
    let rawScore = 0;

    for (const item of crimeData) {
      const weight = CATEGORY_WEIGHTS[item.category] ?? 1;
      const value = item.ratePerHundredK ?? item.count ?? 0;
      rawScore += value * weight;
    }

    const baseline = REGIONAL_BASELINES[granularity] ?? REGIONAL_BASELINES.city;
    const safetyScore = Math.max(0, 100 - (rawScore / baseline) * 100);

    return Math.round(safetyScore * 100) / 100;
  }

  /**
   * Determine colour band for a safety score.
   */
  toColour(score: number): 'green' | 'amber' | 'red' {
    if (score >= 70) return 'green';
    if (score >= 40) return 'amber';
    return 'red';
  }

  /**
   * Convert numeric score to letter grade.
   */
  toGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 80) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 35) return 'D';
    return 'F';
  }
}
