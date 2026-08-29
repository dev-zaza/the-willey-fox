export const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  AUTH_INVALID_CREDENTIALS: 'Incorrect email or password.',
  AUTH_TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  AUTH_TOKEN_INVALID: 'Your session is invalid. Please sign in again.',
  AUTH_EMAIL_NOT_VERIFIED: 'Please verify your email before signing in.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before signing in.',
  AUTH_USER_BANNED: 'Your account has been suspended. Contact support.',
  USER_BANNED: 'Your account has been suspended. Contact support.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  EMAIL_TAKEN: 'An account with this email already exists.',
  OAUTH_ACCOUNT_NO_PASSWORD: 'This account uses Google sign-in. Please continue with Google.',
  INVALID_REFRESH_TOKEN: 'Your session has expired. Please sign in again.',
  INVALID_OR_EXPIRED_RESET_TOKEN: 'This password reset link is invalid or has expired.',
  INVALID_OR_EXPIRED_VERIFICATION_TOKEN: 'This verification link is invalid or has expired.',
  TOKEN_INVALID: 'This link is invalid or has expired.',
  ALREADY_VERIFIED: 'Your email is already verified.',
  VERIFICATION_RATE_LIMITED: 'Please wait before requesting another verification email.',
  GOOGLE_TOKEN_EXCHANGE_FAILED: 'Google sign-in failed. Please try again.',
  GOOGLE_PROFILE_FETCH_FAILED: 'Could not load your Google profile. Please try again.',

  // 2FA
  INVALID_MFA_TOKEN: 'Two-factor session expired. Please sign in again.',
  INVALID_TWO_FACTOR_CODE: 'Incorrect two-factor code.',
  INVALID_TOTP: 'Incorrect two-factor code.',
  TWO_FACTOR_ALREADY_ENABLED: 'Two-factor authentication is already enabled.',
  TWO_FACTOR_NOT_ENABLED: 'Two-factor authentication is not enabled.',
  TWO_FACTOR_SETUP_NOT_INITIATED: 'Please start two-factor setup first.',

  // Phone OTP
  INVALID_OTP: 'Incorrect verification code.',
  OTP_EXPIRED: 'Verification code has expired. Request a new one.',
  NO_PHONE_NUMBER: 'No phone number on file. Add one first.',

  // QR
  QR_NOT_FOUND: 'QR code not found.',
  QR_ACCESS_DENIED: 'You do not have access to this QR code.',
  QR_NOT_OWNER: 'You are not the owner of this QR code.',
  QR_LIMIT_REACHED: 'You have reached your QR code limit. Upgrade for more.',
  QR_ALREADY_CLAIMED: 'This QR code has already been claimed.',
  QR_BULK_LIMIT_EXCEEDED: 'Bulk creation exceeds your plan limit.',

  // Guardians
  GUARDIAN_NOT_FOUND: 'Guardian not found.',
  GUARDIAN_LIMIT_REACHED: 'You have reached your guardian limit. Upgrade for more.',
  GUARDIAN_ALREADY_EXISTS: 'This person is already a guardian.',
  GUARDIAN_UNAVAILABLE: 'Guardian is unavailable.',
  ALREADY_GUARDIAN: 'This person is already a guardian.',
  OWNER_CANNOT_BE_GUARDIAN: 'You cannot add yourself as a guardian.',
  PENDING_REQUEST_NOT_FOUND: 'No pending guardian request found.',
  REQUEST_ALREADY_PENDING: 'A guardian request is already pending.',
  INVITE_NOT_FOUND: 'Invitation not found.',
  INVITE_EXPIRED: 'This invitation has expired.',
  INVITE_ALREADY_USED: 'This invitation has already been used.',
  INVITE_ALREADY_PENDING: 'An invitation is already pending for this email.',

  // Reports
  REPORT_NOT_FOUND: 'Report not found.',

  // Broadcasts
  BROADCAST_DISABLED: 'Public broadcasts are temporarily unavailable.',
  BROADCAST_NOT_FOUND: 'Broadcast not found.',
  BROADCAST_NOT_ACTIVE: 'This broadcast is not active.',
  BROADCAST_EXPIRED: 'This broadcast has expired.',
  BROADCAST_EXTEND_LIMIT_REACHED: 'You have reached the maximum extension limit.',
  BROADCAST_REPORT_NOT_ACTIVE: 'The report must be active to broadcast.',

  // Pins
  PIN_NOT_FOUND: 'Pin not found.',
  PIN_ACCESS_DENIED: 'You do not have access to this pin.',
  PIN_ALREADY_FLAGGED: 'You have already flagged this pin.',

  // Emergency contacts
  EMERGENCY_CONTACT_NOT_FOUND: 'Emergency contact not found.',
  EMERGENCY_CONTACT_LIMIT_REACHED: 'You have reached your emergency contact limit. Upgrade for more.',
  EMERGENCY_CONTACT_ALREADY_EXISTS: 'This emergency contact already exists.',

  // Users
  USER_NOT_FOUND: 'User not found.',
  USER_ALREADY_BLOCKED: 'This user is already blocked.',
  BLOCKED: 'This user is blocked.',
  CANNOT_MESSAGE_SELF: 'You cannot message yourself.',

  // Payments
  SUBSCRIPTION_NOT_FOUND: 'No active subscription found.',
  SUBSCRIPTION_ALREADY_ACTIVE: 'You already have an active subscription.',
  SUBSCRIPTION_ITEM_NOT_FOUND: 'Subscription item not found.',
  PREMIUM_REQUIRED: 'This feature requires a premium subscription.',
  SHOPIFY_INVALID_SIGNATURE: 'Order verification failed. Please contact support.',
  SHOPIFY_UNKNOWN_PRODUCT_TYPE: 'Unknown QR product type.',
  SHOPIFY_PRODUCT_ID_REQUIRED: 'Shopify product ID is required.',
  SHOPIFY_MAPPING_NOT_FOUND: 'Shopify product mapping not found.',
  SHOPIFY_ORDER_NOT_FOUND: 'Shopify order not found.',
  SHOPIFY_ORDER_ITEM_NOT_FOUND: 'Shopify order line item not found.',
  SHOPIFY_QR_IDS_REQUIRED: 'Select at least one QR code.',
  SHOPIFY_ASSIGN_EXCEEDS_QUANTITY: 'Cannot assign more QR codes than the ordered quantity.',
  SHOPIFY_QR_NOT_AVAILABLE: 'One or more QR codes are not available for this product type.',
  SHOPIFY_QR_CANNOT_UNASSIGN: 'Those QR codes cannot be unassigned (already claimed or not on this order).',

  // Places & reviews
  PLACE_NOT_FOUND: 'Place not found.',
  REVIEW_NOT_FOUND: 'Review not found.',
  REVIEW_ALREADY_EXISTS: 'You have already reviewed this place.',
  REVIEW_ALREADY_FLAGGED: 'You have already flagged this review.',
  REVIEW_ACCESS_DENIED: 'You do not have access to this review.',

  // Themes / templates
  THEME_TIER_REQUIRED: 'This theme requires a higher subscription tier.',
  VISUAL_THEME_NOT_FOUND: 'Theme not found.',
  PRINT_TEMPLATE_NOT_FOUND: 'Print template not found.',

  // Files / uploads
  FILE_REQUIRED: 'A file is required.',
  INVALID_FILE_TYPE: 'Unsupported file type.',

  // Generic
  ACCESS_DENIED: 'You do not have permission to do this.',
  ADMIN_REQUIRED: 'Admin access required.',
  SAFETY_ZONE_NOT_FOUND: 'Safety zone not found.',
};

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,}$/;

export function getFriendlyErrorMessage(input: unknown, fallback: string = FALLBACK_MESSAGE): string {
  if (typeof input === 'string') {
    if (ERROR_MESSAGES[input]) return ERROR_MESSAGES[input];
    if (CODE_PATTERN.test(input)) return fallback;
    return input;
  }
  if (Array.isArray(input)) {
    const first = input.find((m): m is string => typeof m === 'string');
    return first ? getFriendlyErrorMessage(first, fallback) : fallback;
  }
  return fallback;
}
