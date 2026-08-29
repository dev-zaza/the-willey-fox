import { families } from '@/lib/api';

export const ONBOARDING_DONE_KEY = 'onboarding_done';

export function isOnboardingDone(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(ONBOARDING_DONE_KEY) === '1';
}

export function markOnboardingDone(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_DONE_KEY, '1');
}

/** Clear so the next login runs the family setup flow (matches mobile signup). */
export function clearOnboardingDone(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ONBOARDING_DONE_KEY);
}

/**
 * After login / OAuth: send new users with no family to onboarding.
 * Existing users (have a family, or already completed/skipped) go to fallback.
 * Admins always go to /admin.
 */
export async function resolvePostAuthPath(options: {
  isAdmin?: boolean;
  fallback?: string;
}): Promise<string> {
  const fallback = options.fallback && options.fallback.startsWith('/') ? options.fallback : '/dashboard';

  if (options.isAdmin) {
    return '/admin';
  }

  // Deep links (claim QR, etc.) should not be blocked by onboarding
  if (fallback !== '/dashboard') {
    return fallback;
  }

  if (isOnboardingDone()) {
    return '/dashboard';
  }

  try {
    const memberships = await families.list();
    if (!memberships || memberships.length === 0) {
      return '/onboard/welcome';
    }
    markOnboardingDone();
    return '/dashboard';
  } catch {
    // Network error — don't trap the user in onboarding
    return '/dashboard';
  }
}
