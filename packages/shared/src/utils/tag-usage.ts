import { QR_CATEGORIES } from '../constants/enums';
import { TIER_LIMITS, isProTier } from '../constants/limits';

export type TagLike = {
  category: string;
  customFields?: Record<string, unknown> | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  pet: 'Pet',
  bag: 'Bag',
  key: 'Keys',
  person: 'Person',
  vehicle: 'Vehicle',
  other: 'Other',
  medical: 'Medical',
  place: 'Place',
};

export function isClaimedPhysicalTag(tag: TagLike): boolean {
  return tag.customFields?.acquisition === 'claimed';
}

export function countDigitalTags(tags: TagLike[]): number {
  return tags.filter((t) => !isClaimedPhysicalTag(t)).length;
}

export function countPhysicalClaims(tags: TagLike[]): number {
  return tags.filter((t) => isClaimedPhysicalTag(t)).length;
}

export function categoryCounts(tags: TagLike[]): Array<{ category: string; label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const tag of tags) {
    const key = tag.category || 'other';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return QR_CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 0).map((category) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    count: counts.get(category) ?? 0,
  }));
}

export function digitalTagAllowance(tier: string | null | undefined): {
  isPro: boolean;
  used: number;
  limit: number;
  left: number | null;
  unlimited: boolean;
} {
  const isPro = isProTier(tier);
  const limit = isPro ? Infinity : TIER_LIMITS.free.maxQrCodes;
  return {
    isPro,
    used: 0,
    limit: Number.isFinite(limit) ? limit : Infinity,
    left: null,
    unlimited: isPro || !Number.isFinite(limit),
  };
}

export function describeDigitalUsage(
  tags: TagLike[],
  tier: string | null | undefined,
): {
  isPro: boolean;
  digitalUsed: number;
  digitalLimit: number;
  digitalLeft: number | null;
  physicalCount: number;
  categories: Array<{ category: string; label: string; count: number }>;
  summaryLine: string;
} {
  const isPro = isProTier(tier);
  const digitalUsed = countDigitalTags(tags);
  const digitalLimit = TIER_LIMITS.free.maxQrCodes;
  const digitalLeft = isPro ? null : Math.max(0, digitalLimit - digitalUsed);
  const physicalCount = countPhysicalClaims(tags);
  const categories = categoryCounts(tags);

  const summaryLine = isPro
    ? `Digital tags unlimited · physical claims unlimited`
    : `${digitalUsed} of ${digitalLimit} digital tags used, ${digitalLeft} left · physical claims unlimited`;

  return {
    isPro,
    digitalUsed,
    digitalLimit,
    digitalLeft,
    physicalCount,
    categories,
    summaryLine,
  };
}

export { CATEGORY_LABELS };
