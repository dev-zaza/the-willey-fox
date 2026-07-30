import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharpFn: (input: string | Buffer) => any = require('sharp');

export type QrMode = 'emergency' | 'lost-found';

// nest-cli's asset copy only runs on `nest build`, not `nest start --watch`,
// so dist/assets can be absent in dev — fall back to the src/ copy.
const DIST_FOX_LOGO_PATH = path.join(__dirname, '../../assets/fox-logo.png');
const SRC_FOX_LOGO_PATH = path.join(__dirname, '../../../src/assets/fox-logo.png');
const FOX_LOGO_PATH = fs.existsSync(DIST_FOX_LOGO_PATH) ? DIST_FOX_LOGO_PATH : SRC_FOX_LOGO_PATH;

/**
 * Generates a branded QR code with the fox logo centered inside.
 *
 * Error correction H (30% tolerance) lets the logo cover ~28% of modules.
 * The fox is placed at final output size — NOT at 3× — because downsampling
 * a 3× render collapses the logo into the dense module pattern invisibly.
 * Mode badge (red cross or orange >>>) overlays the bottom-right of the fox box.
 */
export async function generateFoxQr(
  url: string,
  sizepx: number,
  mode: QrMode = 'lost-found',
): Promise<Buffer> {
  // ── 1. Render QR at target size ────────────────────────────────────────────
  const qrBuffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: sizepx,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });

  // ── 2. Fox logo at 28% of QR width ─────────────────────────────────────────
  const logoPx = Math.round(sizepx * 0.28);
  const pad = Math.round(logoPx * 0.08);
  const padPx = logoPx + pad * 2;
  const badgePx = Math.round(logoPx * 0.34);

  const foxBuf = await sharpFn(FOX_LOGO_PATH)
    .resize(logoPx, logoPx, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toBuffer();

  // ── 3. White rounded-rect background + accent border ───────────────────────
  const accent = mode === 'emergency' ? '#E8392B' : '#FF7B14';
  const bgSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${padPx}" height="${padPx}">
      <rect width="${padPx}" height="${padPx}" rx="10" fill="white"/>
      <rect x="3" y="3" width="${padPx - 6}" height="${padPx - 6}" rx="8"
        fill="none" stroke="${accent}" stroke-width="4"/>
    </svg>`,
  );

  // ── 4. Mode badge ───────────────────────────────────────────────────────────
  const badgeSvg = Buffer.from(buildBadgeSvg(mode, badgePx));

  // Badge sits on bottom-right corner of the fox box
  const cx = Math.round((sizepx - padPx) / 2);
  const cy = Math.round((sizepx - padPx) / 2);
  const foxX = Math.round((sizepx - logoPx) / 2);
  const foxY = Math.round((sizepx - logoPx) / 2);
  const badgeX = cx + padPx - Math.round(badgePx * 0.6);
  const badgeY = cy + padPx - Math.round(badgePx * 0.6);

  // ── 5. Composite: bg rect → fox logo → mode badge ──────────────────────────
  const composed = await sharpFn(qrBuffer)
    .composite([
      { input: bgSvg,    top: cy,     left: cx     },
      { input: foxBuf,   top: foxY,   left: foxX   },
      { input: badgeSvg, top: badgeY, left: badgeX },
    ])
    .png()
    .toBuffer();

  return composed;
}

function buildBadgeSvg(mode: QrMode, size: number): string {
  const r = Math.round(size / 2);
  if (mode === 'emergency') {
    const arm = Math.round(size * 0.2);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${r}" cy="${r}" r="${r}" fill="#E8392B"/>
      <rect x="${r - arm}" y="${Math.round(size * 0.18)}" width="${arm * 2}" height="${Math.round(size * 0.64)}" fill="white" rx="2"/>
      <rect x="${Math.round(size * 0.18)}" y="${r - arm}" width="${Math.round(size * 0.64)}" height="${arm * 2}" fill="white" rx="2"/>
    </svg>`;
  }
  const fs = Math.round(size * 0.38);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${r}" cy="${r}" r="${r}" fill="#FF7B14"/>
    <text x="${r}" y="${Math.round(size * 0.68)}"
      font-family="monospace" font-size="${fs}" font-weight="bold"
      fill="white" text-anchor="middle">&gt;&gt;&gt;</text>
  </svg>`;
}
