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
  monthly: 499,  // $4.99/month
  annual: 4999,  // $49.99/year
} as const;

export const STRIPE_TRIAL_DAYS = 7;

export const TIER_LIMITS = {
  free: {
    maxQrCodes: 5,
    maxGuardians: 2,
    maxPinsPerDay: 5,
    qrExpiryDays: null,
  },
  basic: {
    maxQrCodes: 10,
    maxGuardians: 5,
    maxPinsPerDay: 20,
    qrExpiryDays: null,
  },
  premium: {
    maxQrCodes: 50,
    maxGuardians: 20,
    maxPinsPerDay: 100,
    qrExpiryDays: null,
  },
  enterprise: {
    maxQrCodes: Infinity,
    maxGuardians: Infinity,
    maxPinsPerDay: Infinity,
    qrExpiryDays: null,
  },
} as const;
