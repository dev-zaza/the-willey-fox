import { isProTier } from '@safetag/shared';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1').replace(
  /\/$/,
  '',
);

export type GuideAuthResult =
  | { ok: true; user: { id: string; subscriptionTier: string } }
  | { ok: false; status: number; message: string };

/** Verify Bearer JWT against the Nest API and require a Pro tier. */
export async function requireProFromRequest(req: Request): Promise<GuideAuthResult> {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Sign in required to view travel guides.' };
  }

  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: auth },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, status: 401, message: 'Session expired. Please sign in again.' };
    }
    const user = (await res.json()) as { id: string; subscriptionTier?: string };
    if (!isProTier(user.subscriptionTier)) {
      return {
        ok: false,
        status: 403,
        message: 'Full travel guides are included with Pro. Upgrade to unlock.',
      };
    }
    return { ok: true, user: { id: user.id, subscriptionTier: user.subscriptionTier || 'premium' } };
  } catch {
    return { ok: false, status: 503, message: 'Could not verify your account. Try again shortly.' };
  }
}
