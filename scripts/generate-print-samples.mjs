/**
 * Generates one print-ready PDF per format under docs/print-samples/.
 * Each PDF page is sized to the physical trim dimensions of the format.
 * Injects a real QR code into each template's placeholder.
 * No DB or backend server needed — reads assets directly.
 *
 * Usage:
 *   node scripts/generate-print-samples.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const QRCode = require('../node_modules/qrcode');
const puppeteer = require('../node_modules/puppeteer');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const ASSETS_DIR = path.join(ROOT, 'apps/backend/src/assets/print-svg');
const OUT_DIR = path.join(ROOT, 'docs/print-samples');

const SAMPLE_URL = 'https://safetag.app/q/SAMPLE-001';

const PRINT_FORMATS = {
  'name-tag-emergency':  { label: 'Name Tag (Emergency)',          front: '01_name-tag_emergency_64x30.svg' },
  'name-tag-square':     { label: 'Name Tag (Square)',             front: '02_name-tag_square_45x45.svg' },
  'item-sticker':        { label: 'Item Sticker',                  front: '03_item-sticker_50x25.svg' },
  'item-mini':           { label: 'Item Mini',                     front: '04_item-mini_30x30.svg' },
  'luggage-tag':         { label: 'Luggage Tag',                   front: '06_luggage-tag_front_writeon_54x90.svg', reverse: '06_luggage-tag_reverse_writeon_54x90.svg', wMm: 54, hMm: 90 },
  'keyring':             { label: 'Keyring',                       front: '07_keyring_front_fox_38.svg',           reverse: '08_keyring_reverse_qr_38.svg' },
  'wristband-medical':   { label: 'Wristband (Medical)',           front: '09_wristband_medical_250x25.svg' },
  'wristband-event':     { label: 'Wristband (Event / Kids)',      front: '10_wristband_event-kids_250x25.svg' },
  'luggage-bar':         { label: 'Luggage Bar',                   front: '10-luggage-bar-90x35mm-print.svg' },
};

let foxB64 = null;
const foxPath = path.join(ASSETS_DIR, 'fox-cutout.png');
if (fs.existsSync(foxPath)) {
  foxB64 = fs.readFileSync(foxPath).toString('base64');
}

async function renderSvg(fileName, scanUrl) {
  const raw = fs.readFileSync(path.join(ASSETS_DIR, fileName), 'utf8');
  let svg = raw;

  // Inline fox-cutout.png
  if (foxB64) {
    svg = svg
      .split('href="fox-cutout.png"').join(`href="data:image/png;base64,${foxB64}"`)
      .split('xlink:href="fox-cutout.png"').join(`xlink:href="data:image/png;base64,${foxB64}"`);
  }

  // Inject QR into placeholder (any rect with stroke-dasharray)
  if (scanUrl) {
    const boxMatch = svg.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke-dasharray[^>]*>/);
    if (boxMatch) {
      const [, bx, by, bw, bh] = boxMatch.map(Number);
      const qrBuf = await QRCode.toBuffer(scanUrl, {
        type: 'png',
        width: 1024,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#1a1a1a', light: '#ffffff' },
      });
      const qrB64 = qrBuf.toString('base64');
      svg = svg.replace(
        /<rect [^>]*stroke-dasharray[^>]*>/,
        `<image href="data:image/png;base64,${qrB64}" xlink:href="data:image/png;base64,${qrB64}" x="${bx}" y="${by}" width="${bw}" height="${bh}"></image>`,
      );
    }
  }

  return svg;
}

const uniqueClipId = (svg, idx) =>
  svg.split('id="clip"').join(`id="clip-${idx}"`).split('url(#clip)').join(`url(#clip-${idx})`);

async function svgToPdf(browser, pages, wMm, hMm) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Spline+Sans+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,600&display=swap');
  * { margin:0; padding:0; }
  @page { size: ${wMm}mm ${hMm}mm; margin: 0; }
  html,body { width:${wMm}mm; }
  .tag-page { width:${wMm}mm; height:${hMm}mm; page-break-after: always; overflow: hidden; }
  .tag-page:last-child { page-break-after: auto; }
  .tag-page svg { display:block; width:${wMm}mm; height:${hMm}mm; }
</style></head>
<body>${pages.map((svg) => `<div class="tag-page">${svg}</div>`).join('')}</body></html>`;

  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluateHandle('document.fonts.ready');
    return Buffer.from(await page.pdf({
      width: `${wMm}mm`,
      height: `${hMm}mm`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    }));
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  let generated = 0;
  let skipped = 0;

  try {
    for (const [key, fmt] of Object.entries(PRINT_FORMATS)) {
      const frontFile = path.join(ASSETS_DIR, fmt.front);
      if (!fs.existsSync(frontFile)) {
        console.warn(`  SKIP  ${fmt.front} — file not found`);
        skipped++;
        continue;
      }

      const pages = [];
      let wMm = 0, hMm = 0;
      let idx = 0;

      const frontSvg = await renderSvg(fmt.front, SAMPLE_URL);
      const dims = frontSvg.match(/width="([\d.]+)mm" height="([\d.]+)mm"/);
      if (dims) {
        wMm = Number(dims[1]);
        hMm = Number(dims[2]);
      } else if (fmt.wMm && fmt.hMm) {
        wMm = fmt.wMm;
        hMm = fmt.hMm;
      } else {
        console.warn(`  SKIP  ${fmt.front} — no mm dimensions on root <svg>`);
        skipped++;
        continue;
      }
      pages.push(uniqueClipId(frontSvg, idx++));

      if (fmt.reverse) {
        const revFile = path.join(ASSETS_DIR, fmt.reverse);
        if (fs.existsSync(revFile)) {
          const revSvg = await renderSvg(fmt.reverse, SAMPLE_URL);
          pages.push(uniqueClipId(revSvg, idx++));
        }
      }

      const pdf = await svgToPdf(browser, pages, wMm, hMm);
      const outName = `${key}.pdf`;
      fs.writeFileSync(path.join(OUT_DIR, outName), pdf);
      const sides = pages.length > 1 ? ' (front + reverse)' : '';
      console.log(`  OK    ${outName}  ${wMm}×${hMm}mm${sides}  — ${fmt.label}`);
      generated++;
    }
  } finally {
    await browser.close();
  }

  console.log(`\nDone. ${generated} PDFs written to docs/print-samples/`);
  if (skipped) console.warn(`${skipped} formats skipped (assets missing or no mm dims).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
