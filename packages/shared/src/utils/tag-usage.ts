import { QR_CATEGORIES } from '../constants/enums';
import { TIER_LIMITS, isProTier } from '../constants/limits';

export type TagLike = {
  category: string;
  customFields?: Record<string, unknown> | null;
  familyId?: string | null;
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

/** Family / protected-person profiles never consume free-plan quota. */
export function isFamilyProfileTag(tag: TagLike): boolean {
  const fields = tag.customFields ?? {};
  if (fields.familyProfile === true) return true;
  if (typeof fields.relationship === 'string' && fields.relationship.trim().length > 0) {
    return tag.category === 'person' || tag.category === 'pet' || tag.category === 'medical';
  }
  if (tag.familyId) {
    return tag.category === 'person' || tag.category === 'pet' || tag.category === 'medical';
  }
  return false;
}

export function countDigitalTags(tags: TagLike[]): number {
  return tags.filter((t) => !isClaimedPhysicalTag(t) && !isFamilyProfileTag(t)).length;
}

export function countPhysicalClaims(tags: TagLike[]): number {
  return tags.filter((t) => isClaimedPhysicalTag(t)).length;
}

export function countFamilyProfiles(tags: TagLike[]): number {
  return tags.filter((t) => isFamilyProfileTag(t)).length;
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

export function physicalTagAllowance(tier: string | null | undefined): {
  isPro: boolean;
  used: number;
  limit: number;
  left: number | null;
  unlimited: boolean;
} {
  const isPro = isProTier(tier);
  const limit = isPro ? Infinity : TIER_LIMITS.free.maxPhysicalTags;
  return {
    isPro,
    used: 0,
    limit: Number.isFinite(limit) ? limit : Infinity,
    left: null,
    unlimited: isPro || !Number.isFinite(limit),
  };
}

/** @deprecated Use physicalTagAllowance — free plan caps physical tags, not digital generate. */
export function digitalTagAllowance(tier: string | null | undefined) {
  return physicalTagAllowance(tier);
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
  physicalLimit: number;
  physicalLeft: number | null;
  familyProfileCount: number;
  categories: Array<{ category: string; label: string; count: number }>;
  summaryLine: string;
} {
  const isPro = isProTier(tier);
  const physicalCount = countPhysicalClaims(tags);
  const physicalLimit = TIER_LIMITS.free.maxPhysicalTags;
  const physicalLeft = isPro ? null : Math.max(0, physicalLimit - physicalCount);
  const familyProfileCount = countFamilyProfiles(tags);
  const digitalUsed = countDigitalTags(tags);
  const categories = categoryCounts(tags);

  const summaryLine = isPro
    ? `Physical tags unlimited · family profiles unlimited`
    : `${physicalCount} of ${physicalLimit} physical tags used, ${physicalLeft} left · family profiles free`;

  return {
    isPro,
    digitalUsed,
    digitalLimit: Infinity,
    digitalLeft: null,
    physicalCount,
    physicalLimit,
    physicalLeft,
    familyProfileCount,
    categories,
    summaryLine,
  };
}

export { CATEGORY_LABELS };
