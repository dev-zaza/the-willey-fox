/**
 * Stripe price IDs — set from environment / config at runtime.
 * These are placeholder keys that map to real price IDs in .env.
 * Use STRIPE_PRICE_ID_MONTHLY and STRIPE_PRICE_ID_ANNUAL env vars on the backend.
 */
export const STRIPE_PRICE_KEYS = {
  MONTHLY: 'STRIPE_PRICE_ID_MONTHLY',
  ANNUAL: 'STRIPE_PRICE_ID_ANNUAL',
} as const;

export const SUBSCRIPTION_PRICES_USD = {
  monthly: 499, // $4.99/month — legacy constants; live prices come from settings/Stripe
  annual: 4999, // $49.99/year
} as const;

export const STRIPE_TRIAL_DAYS = 7;

/**
 * Product model: Free vs Pro only.
 * Pro is sold as monthly or yearly Stripe subscription.
 * DB still has basic/premium/enterprise for legacy rows — all map to Pro (unlimited).
 */
export const TIER_LIMITS = {
  free: {
    maxQrCodes: 5,
    maxFamilies: 1,
    maxGuardians: 2,
    maxPinsPerDay: 5,
    qrExpiryDays: null,
  },
  /** @deprecated Legacy paid tier — treated as Pro (unlimited). */
  basic: {
    maxQrCodes: Infinity,
    maxFamilies: Infinity,
    maxGuardians: Infinity,
    maxPinsPerDay: Infinity,
    qrExpiryDays: null,
  },
  /** Pro (monthly or yearly checkout). */
  premium: {
    maxQrCodes: Infinity,
    maxFamilies: Infinity,
    maxGuardians: Infinity,
    maxPinsPerDay: Infinity,
    qrExpiryDays: null,
  },
  /** @deprecated Legacy paid tier — treated as Pro (unlimited). */
  enterprise: {
    maxQrCodes: Infinity,
    maxFamilies: Infinity,
    maxGuardians: Infinity,
    maxPinsPerDay: Infinity,
    qrExpiryDays: null,
  },
} as const;

/** True for any paid / Pro subscription (including legacy basic & enterprise). */
export function isProTier(tier: string | null | undefined): boolean {
  if (!tier) return false;
  const normalized = tier.toLowerCase();
  return (
    normalized === 'basic' ||
    normalized === 'premium' ||
    normalized === 'enterprise' ||
    normalized === 'pro'
  );
}
