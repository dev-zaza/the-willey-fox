import { createHmac, timingSafeEqual } from 'crypto';
import fs from 'fs';
import path from 'path';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ASSET_TTL_SECONDS = 60 * 60 * 6; // 6 hours

/** Cities with a full curated HTML guide under content/city-guides. */
export const CURATED_GUIDE_SLUGS = ['london', 'munich', 'nuremberg'] as const;

export function normalizeGuideSlug(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, '-').replace(/_/g, '-');
}

function guideSecret(): string {
  return (
    process.env.GUIDE_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    'wileyfox-guide-dev-secret-change-me'
  );
}

/** Stable 8-char access code for a city guide (not guessable without the server secret). */
export function getGuideAccessCode(citySlug: string): string {
  const slug = normalizeGuideSlug(citySlug);
  const digest = createHmac('sha256', guideSecret()).update(`guide:${slug}`).digest();
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[digest[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function verifyGuideAccessCode(citySlug: string, code: string): boolean {
  const expected = getGuideAccessCode(citySlug);
  const given = (code || '').trim().toUpperCase();
  if (given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  } catch {
    return false;
  }
}

export function guideContentRoot(): string {
  return path.join(process.cwd(), 'content', 'city-guides');
}

export function curatedGuideDir(citySlug: string): string | null {
  const slug = normalizeGuideSlug(citySlug);
  const dir = path.join(guideContentRoot(), slug);
  const indexPath = path.join(dir, 'index.html');
  if (!fs.existsSync(indexPath)) return null;
  return dir;
}

export function hasCuratedGuide(citySlug: string): boolean {
  return curatedGuideDir(citySlug) != null;
}

function signAssetQuery(citySlug: string, accessCode: string, assetPath: string, exp: number): string {
  return createHmac('sha256', guideSecret())
    .update(`asset:${normalizeGuideSlug(citySlug)}:${accessCode.toUpperCase()}:${assetPath}:${exp}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyAssetSignature(
  citySlug: string,
  accessCode: string,
  assetPath: string,
  expRaw: string | null,
  sig: string | null,
): boolean {
  if (!expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = signAssetQuery(citySlug, accessCode, assetPath, exp);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

function rewriteAssetUrl(citySlug: string, accessCode: string, relativeAsset: string): string {
  const assetPath = relativeAsset.replace(/^\/+/, '');
  const exp = Math.floor(Date.now() / 1000) + ASSET_TTL_SECONDS;
  const sig = signAssetQuery(citySlug, accessCode, assetPath, exp);
  const slug = normalizeGuideSlug(citySlug);
  const code = accessCode.toUpperCase();
  return `/api/guides/${encodeURIComponent(slug)}/${encodeURIComponent(code)}/assets/${assetPath}?exp=${exp}&sig=${sig}`;
}

export function readCuratedGuideHtml(citySlug: string, accessCode: string): string | null {
  const dir = curatedGuideDir(citySlug);
  if (!dir) return null;
  const htmlPath = path.join(dir, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const code = accessCode.toUpperCase();

  html = html.replace(
    /(src|href)=(["'])(?:\.\/)?img\/([^"']+)\2/gi,
    (_m, attr: string, quote: string, file: string) => {
      const url = rewriteAssetUrl(citySlug, code, `img/${file}`);
      return `${attr}=${quote}${url}${quote}`;
    },
  );

  return html;
}

/** Resolve a file under the guide folder; rejects path traversal. */
export function resolveGuideAsset(citySlug: string, assetPath: string): string | null {
  const dir = curatedGuideDir(citySlug);
  if (!dir) return null;
  const cleaned = assetPath.replace(/^\/+/, '').replace(/\\/g, '/');
  if (cleaned.includes('..')) return null;
  const full = path.join(dir, cleaned);
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(dir) + path.sep) && resolved !== path.resolve(dir)) {
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  return resolved;
}
