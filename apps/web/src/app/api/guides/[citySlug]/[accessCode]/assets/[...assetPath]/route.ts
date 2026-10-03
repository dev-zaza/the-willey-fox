import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import {
  normalizeGuideSlug,
  resolveGuideAsset,
  verifyAssetSignature,
  verifyGuideAccessCode,
} from '@/lib/guide-access';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

/**
 * Gated asset proxy — requires valid guide access code + short-lived signed query.
 * GET /api/guides/:citySlug/:accessCode/assets/img/...?exp=&sig=
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ citySlug: string; accessCode: string; assetPath: string[] }> },
) {
  const { citySlug: raw, accessCode, assetPath } = await ctx.params;
  const citySlug = normalizeGuideSlug(raw);

  if (!verifyGuideAccessCode(citySlug, accessCode)) {
    return NextResponse.json({ message: 'Invalid guide access code.' }, { status: 403 });
  }

  const relative = (assetPath || []).join('/');
  const url = new URL(req.url);
  if (!verifyAssetSignature(citySlug, accessCode, relative, url.searchParams.get('exp'), url.searchParams.get('sig'))) {
    return NextResponse.json({ message: 'Asset link expired or invalid.' }, { status: 403 });
  }

  const filePath = resolveGuideAsset(citySlug, relative);
  if (!filePath) {
    return NextResponse.json({ message: 'Asset not found.' }, { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
