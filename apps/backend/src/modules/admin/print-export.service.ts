import { Injectable, Inject, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import puppeteer, { Browser } from 'puppeteer';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { qrBatches, qrCodes } from '../../database/schema';

// ── Format definitions ──────────────────────────────────────────────────────
// Each entry maps to a print-ready SVG under src/assets/print-svg. Page size
// (trim + 3mm bleed) is baked into each SVG's own width/height — no separate
// mm bookkeeping needed here.

export const PRINT_FORMATS = {
  'name-tag-emergency': {
    label: 'Name Tag (Emergency)',
    front: '01_name-tag_emergency_64x30.svg',
  },
  'name-tag-square': {
    label: 'Name Tag (Square)',
    front: '02_name-tag_square_45x45.svg',
  },
  'item-sticker': {
    label: 'Item Sticker',
    front: '03_item-sticker_50x25.svg',
  },
  'item-mini': {
    label: 'Item Mini',
    front: '04_item-mini_30x30.svg',
  },
  'luggage-tag': {
    label: 'Luggage Tag',
    front: '06_luggage-tag_front_writeon_54x90.svg',
    reverse: '06_luggage-tag_reverse_writeon_54x90.svg',
    wMm: 54,
    hMm: 90,
  },
  'keyring': {
    label: 'Keyring',
    front: '07_keyring_front_fox_38.svg',
    reverse: '08_keyring_reverse_qr_38.svg',
  },
  'wristband-medical': {
    label: 'Wristband (Medical)',
    front: '09_wristband_medical_250x25.svg',
  },
  'wristband-event': {
    label: 'Wristband (Event / Kids)',
    front: '10_wristband_event-kids_250x25.svg',
  },
  'luggage-bar': {
    label: 'Luggage Bar',
    front: '10-luggage-bar-90x35mm-print.svg',
  },
} as const;

export type PrintFormatKey = keyof typeof PRINT_FORMATS;

// nest-cli's asset copy only runs on `nest build`, not `nest start --watch`,
// so dist/assets can be absent in dev — fall back to the src/ copy.
const DIST_ASSETS_DIR = path.join(__dirname, '../../assets/print-svg');
const SRC_ASSETS_DIR = path.join(__dirname, '../../../src/assets/print-svg');

function assetsDir(): string {
  return fs.existsSync(DIST_ASSETS_DIR) ? DIST_ASSETS_DIR : SRC_ASSETS_DIR;
}

let foxCutoutB64Cache: string | null | undefined;

function foxCutoutB64(): string | null {
  if (foxCutoutB64Cache !== undefined) return foxCutoutB64Cache;
  const foxPath = path.join(assetsDir(), 'fox-cutout.png');
  foxCutoutB64Cache = fs.existsSync(foxPath) ? fs.readFileSync(foxPath).toString('base64') : null;
  return foxCutoutB64Cache;
}

const templateCache = new Map<string, string>();

function loadTemplate(fileName: string): string {
  const cached = templateCache.get(fileName);
  if (cached) return cached;
  const raw = fs.readFileSync(path.join(assetsDir(), fileName), 'utf8');
  templateCache.set(fileName, raw);
  return raw;
}

/**
 * Injects a real QR PNG into the dashed placeholder box of a print-svg template.
 * Templates without a placeholder (e.g. text-only reverse sides) render unchanged.
 */
async function renderSvgWithQr(
  fileName: string,
  scanUrl: string | null,
  overrideDims?: { wMm: number; hMm: number },
): Promise<{ svg: string; wMm: number; hMm: number }> {
  let svg = loadTemplate(fileName);

  const dims = svg.match(/width="([\d.]+)mm" height="([\d.]+)mm"/);
  let wMm: number;
  let hMm: number;
  if (dims) {
    wMm = Number(dims[1]);
    hMm = Number(dims[2]);
  } else if (overrideDims) {
    wMm = overrideDims.wMm;
    hMm = overrideDims.hMm;
  } else {
    throw new Error(`${fileName}: missing mm width/height on root <svg>`);
  }

  const foxB64 = foxCutoutB64();
  if (foxB64) {
    svg = svg
      .split('href="fox-cutout.png"').join(`href="data:image/png;base64,${foxB64}"`)
      .split('xlink:href="fox-cutout.png"').join(`xlink:href="data:image/png;base64,${foxB64}"`);
  }

  if (scanUrl) {
    const boxMatch = svg.match(
      /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke-dasharray[^>]*>/,
    );
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
      svg = svg.replace(/<text[^>]*>QR<\/text>/, '');
      svg = svg.replace(/<text[^>]*>PLACE<\/text>/, '');
    }
  }

  return { svg, wMm, hMm };
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class PrintExportService implements OnModuleDestroy {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private browserPromise: Promise<Browser> | null = null;

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browserPromise;
  }

  async onModuleDestroy() {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
    }
  }

  async exportBatchPrintPdf(
    batchId: string,
    publicBaseUrl: string,
    formatKey: PrintFormatKey,
  ): Promise<Buffer> {
    const [batch] = await this.db
      .select()
      .from(qrBatches)
      .where(eq(qrBatches.id, batchId))
      .limit(1);

    if (!batch) throw new NotFoundException('Batch not found');

    const codes = await this.db
      .select({ uniqueCode: qrCodes.uniqueCode })
      .from(qrCodes)
      .where(eq(qrCodes.batchId, batchId));

    if (codes.length === 0) throw new NotFoundException('Batch has no codes');

    const fmt = PRINT_FORMATS[formatKey];
    if (!fmt) throw new NotFoundException(`Unknown print format: ${formatKey}`);

    // Front/reverse of a given format share identical trim+bleed dimensions,
    // so every page in this export uses one fixed page size — safe to render
    // the whole batch as a single HTML doc with page-break-after per tag.
    const pages: string[] = [];
    let wMm = 0;
    let hMm = 0;
    let pageIndex = 0;

    // Every template reuses the same clipPath id="clip" — fine standalone, but
    // HTML doesn't scope SVG ids per element, so batching pages needs unique ids.
    const uniqueClipId = (svg: string, idx: number) =>
      svg.split('id="clip"').join(`id="clip-${idx}"`).split('url(#clip)').join(`url(#clip-${idx})`);

    for (const { uniqueCode } of codes) {
      const scanUrl = `${publicBaseUrl}/q/${uniqueCode}`;
      const fmtDims = 'wMm' in fmt ? { wMm: (fmt as any).wMm, hMm: (fmt as any).hMm } : undefined;

      const front = await renderSvgWithQr(fmt.front, scanUrl, fmtDims);
      wMm = front.wMm;
      hMm = front.hMm;
      pages.push(uniqueClipId(front.svg, pageIndex++));

      if ('reverse' in fmt && fmt.reverse) {
        const reverse = await renderSvgWithQr(fmt.reverse, scanUrl, fmtDims);
        pages.push(uniqueClipId(reverse.svg, pageIndex++));
      }
    }

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
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

      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluateHandle('document.fonts.ready');

      return Buffer.from(
        await page.pdf({
          width: `${wMm}mm`,
          height: `${hMm}mm`,
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        }),
      );
    } finally {
      await page.close();
    }
  }
}
