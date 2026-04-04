export const QR_CATEGORIES = ['pet', 'bag', 'key', 'person', 'vehicle', 'other', 'medical', 'place'] as const;

/** Categories that cannot be deleted by admins — they are core platform categories */
export const CORE_QR_CATEGORIES = ['person'] as const;
export const SUBSCRIPTION_TIERS = ['free', 'basic', 'premium', 'enterprise'] as const;
export const GUARDIAN_STATUSES = ['pending', 'active', 'removed'] as const;
export const REPORT_STATUSES = ['open', 'contacted', 'resolved', 'closed'] as const;
export const NOTIFICATION_TYPES = ['email', 'sms', 'push'] as const;
export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed', 'retrying'] as const;

export const PIN_TYPES = ['hazard', 'roadblock', 'construction', 'safety_alert', 'traffic', 'event', 'other'] as const;
export const PIN_STATUSES = ['active', 'expired', 'deactivated'] as const;

export const SAFETY_SOURCES = ['uk_police', 'eurostat', 'fbi', 'numbeo', 'city_portal', 'community'] as const;
export const SAFETY_GRANULARITIES = ['street', 'neighbourhood', 'city', 'country'] as const;

export const EMERGENCY_CONTACT_STATUSES = ['pending', 'accepted', 'declined'] as const;
export const CONVERSATION_STATUSES = ['active', 'blocked', 'archived'] as const;
export const PLACE_TYPES = ['hotel', 'restaurant', 'cafe', 'bar', 'attraction', 'park', 'transport_hub', 'shopping', 'other'] as const;

export const ROUTE_RATING_TAGS = ['safe', 'well_lit', 'heavy_traffic', 'road_works', 'felt_unsafe', 'recommended'] as const;

export const SAFETY_SCORE_THRESHOLDS = {
  GREEN: 70,
  AMBER: 40,
} as const;

export const ERROR_CODES = {
  // Auth
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_USER_BANNED: 'AUTH_USER_BANNED',
  // QR
  QR_NOT_FOUND: 'QR_NOT_FOUND',
  QR_ACCESS_DENIED: 'QR_ACCESS_DENIED',
  QR_LIMIT_REACHED: 'QR_LIMIT_REACHED',
  QR_ALREADY_CLAIMED: 'QR_ALREADY_CLAIMED',
  QR_BULK_LIMIT_EXCEEDED: 'QR_BULK_LIMIT_EXCEEDED',
  // Guardians
  GUARDIAN_NOT_FOUND: 'GUARDIAN_NOT_FOUND',
  GUARDIAN_LIMIT_REACHED: 'GUARDIAN_LIMIT_REACHED',
  GUARDIAN_ALREADY_EXISTS: 'GUARDIAN_ALREADY_EXISTS',
  // Reports
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  // Pins
  PIN_NOT_FOUND: 'PIN_NOT_FOUND',
  PIN_ACCESS_DENIED: 'PIN_ACCESS_DENIED',
  // Emergency
  EMERGENCY_CONTACT_NOT_FOUND: 'EMERGENCY_CONTACT_NOT_FOUND',
  EMERGENCY_CONTACT_LIMIT_REACHED: 'EMERGENCY_CONTACT_LIMIT_REACHED',
  EMERGENCY_CONTACT_ALREADY_EXISTS: 'EMERGENCY_CONTACT_ALREADY_EXISTS',
  // Users
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  // Payments
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_ALREADY_ACTIVE: 'SUBSCRIPTION_ALREADY_ACTIVE',
  // Safety
  SAFETY_ZONE_NOT_FOUND: 'SAFETY_ZONE_NOT_FOUND',
  // Places
  PLACE_NOT_FOUND: 'PLACE_NOT_FOUND',
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND',
  REVIEW_ALREADY_EXISTS: 'REVIEW_ALREADY_EXISTS',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
