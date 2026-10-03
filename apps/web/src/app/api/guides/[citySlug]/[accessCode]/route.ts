import { NextResponse } from 'next/server';
import { requireProFromRequest } from '@/lib/guide-auth';
import {
  hasCuratedGuide,
  normalizeGuideSlug,
  readCuratedGuideHtml,
  verifyGuideAccessCode,
} from '@/lib/guide-access';

export const runtime = 'nodejs';

/**
 * Pro-only: returns curated guide HTML when access code is valid.
 * GET /api/guides/:citySlug/:accessCode
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ citySlug: string; accessCode: string }> },
) {
  const auth = await requireProFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { citySlug: raw, accessCode } = await ctx.params;
  const citySlug = normalizeGuideSlug(raw);

  if (!verifyGuideAccessCode(citySlug, accessCode)) {
    return NextResponse.json({ message: 'Invalid guide access code.' }, { status: 403 });
  }

  if (!hasCuratedGuide(citySlug)) {
    return NextResponse.json(
      { available: false, message: 'This travel guide will be updated soon.' },
      { status: 404 },
    );
  }

  const html = readCuratedGuideHtml(citySlug, accessCode.toUpperCase());
  if (!html) {
    return NextResponse.json(
      { available: false, message: 'This travel guide will be updated soon.' },
      { status: 404 },
    );
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
