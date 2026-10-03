import { NextResponse } from 'next/server';
import { requireProFromRequest } from '@/lib/guide-auth';
import {
  getGuideAccessCode,
  hasCuratedGuide,
  normalizeGuideSlug,
} from '@/lib/guide-access';

export const runtime = 'nodejs';

/**
 * Pro-only: returns the unique access code + path for a city guide.
 * GET /api/guides/:citySlug/access
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ citySlug: string }> },
) {
  const auth = await requireProFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { citySlug: raw } = await ctx.params;
  const citySlug = normalizeGuideSlug(raw);
  const available = hasCuratedGuide(citySlug);
  const accessCode = getGuideAccessCode(citySlug);

  return NextResponse.json({
    citySlug,
    available,
    accessCode,
    path: `/guides/${citySlug}/${accessCode}`,
  });
}
