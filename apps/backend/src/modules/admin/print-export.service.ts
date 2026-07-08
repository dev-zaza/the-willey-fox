import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { qrBatches, qrCodes } from '../../database/schema';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { generateFoxQr } from './fox-qr.util';
import type { QrMode } from './fox-qr.util';

// ── Format definitions ──────────────────────────────────────────────────────

export const PRINT_FORMATS = {
  'name-tag': {
    label: 'Name Tag',
    trimMm: { w: 64, h: 30 },
    bleedMm: 3,
    safeMm: 3,
    minQrMm: 18,
    mode: 'emergency' as QrMode,
    orientation: 'landscape' as const,
  },
  'name-tag-square': {
    label: 'Name Tag (Square)',
    trimMm: { w: 45, h: 45 },
    bleedMm: 3,
    safeMm: 3,
    minQrMm: 18,
    mode: 'lost-found' as QrMode,
    orientation: 'portrait' as const,
  },
  'item-sticker': {
    label: 'Item Sticker',
    trimMm: { w: 50, h: 25 },
    bleedMm: 3,
    safeMm: 2,
    minQrMm: 15,
    mode: 'lost-found' as QrMode,
    orientation: 'landscape' as const,
  },
  'item-mini': {
    label: 'Item Mini',
    trimMm: { w: 30, h: 30 },
    bleedMm: 3,
    safeMm: 2,
    minQrMm: 15,
    mode: 'lost-found' as QrMode,
    orientation: 'portrait' as const,
  },
  'luggage-tag': {
    label: 'Luggage Tag',
    trimMm: { w: 54, h: 100 },
    bleedMm: 3,
    safeMm: 4,
    minQrMm: 20,
    mode: 'lost-found' as QrMode,
    orientation: 'portrait' as const,
    hasReverse: true,
  },
  'luggage-sticker': {
    label: 'Luggage Sticker',
    trimMm: { w: 90, h: 35 },
    bleedMm: 3,
    safeMm: 3,
    minQrMm: 16,
    mode: 'lost-found' as QrMode,
    orientation: 'landscape' as const,
  },
  'keyring-fob': {
    label: 'Keyring Fob',
    trimMm: { w: 38, h: 58 },
    bleedMm: 0,
    safeMm: 3,
    minQrMm: 15,
    mode: 'lost-found' as QrMode,
    orientation: 'portrait' as const,
  },
  'wristband-hospital': {
    label: 'Wristband (Hospital)',
    trimMm: { w: 250, h: 25 },
    bleedMm: 3,
    safeMm: 4,
    minQrMm: 14,
    mode: 'emergency' as QrMode,
    orientation: 'landscape' as const,
  },
  'wristband-event': {
    label: 'Wristband (Event/Kids)',
    trimMm: { w: 250, h: 25 },
    bleedMm: 3,
    safeMm: 4,
    minQrMm: 14,
    mode: 'lost-found' as QrMode,
    orientation: 'landscape' as const,
  },
} as const;

export type PrintFormatKey = keyof typeof PRINT_FORMATS;

// ── Unit helpers ────────────────────────────────────────────────────────────

const MM_TO_PT = 2.8346; // 1mm = 2.8346pt (PDFKit uses pt)
const DPI = 300;

function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

function mmToPx(mm: number): number {
  return Math.round(mm * (DPI / 25.4));
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class PrintExportService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async exportBatchPrintPdf(
    batchId: string,
    publicBaseUrl: string,
    formatKey: PrintFormatKey,
    foxQr = true,
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
    const isWristband = formatKey.startsWith('wristband');
    const hasReverse = 'hasReverse' in fmt && fmt.hasReverse === true;

    const bleedPt = mmToPt(fmt.bleedMm);
    const trimWPt = mmToPt(fmt.trimMm.w);
    const trimHPt = mmToPt(fmt.trimMm.h);
    const pageWPt = trimWPt + bleedPt * 2;
    const pageHPt = trimHPt + bleedPt * 2;

    const qrPx = mmToPx(fmt.minQrMm);

    const buffers: Buffer[] = [];

    const doc = new PDFDocument({
      autoFirstPage: false,
      compress: true,
      info: {
        Title: `SafeTag ${fmt.label} — Batch ${batchId.slice(0, 8)}`,
        Author: 'TheWileyfox',
        Subject: `Print-ready QR tags — ${codes.length} codes`,
      },
    });

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    for (const { uniqueCode } of codes) {
      const scanUrl = `${publicBaseUrl}/q/${uniqueCode}`;

      let qrBuf: Buffer;
      if (foxQr) {
        qrBuf = await generateFoxQr(scanUrl, qrPx, fmt.mode);
      } else {
        const { default: QRCode } = await import('qrcode') as any;
        qrBuf = await QRCode.toBuffer(scanUrl, {
          type: 'png',
          width: qrPx,
          margin: 1,
          errorCorrectionLevel: 'H',
        });
      }

      // ── FRONT PAGE ──────────────────────────────────────────────────────
      doc.addPage({ size: [pageWPt, pageHPt], margin: 0 });

      if (isWristband) {
        drawWristbandFront(doc, fmt, bleedPt, trimWPt, trimHPt, qrBuf, qrPx, uniqueCode);
      } else if (formatKey === 'luggage-tag') {
        drawLuggageTagFront(doc, fmt, bleedPt, trimWPt, trimHPt, qrBuf, qrPx, uniqueCode);
      } else {
        drawStandardFront(doc, fmt, bleedPt, trimWPt, trimHPt, qrBuf, qrPx, uniqueCode, formatKey);
      }

      // Cut contour (trim box) — dashed magenta, stays outside safe zone
      drawCutContour(doc, bleedPt, trimWPt, trimHPt);

      // ── REVERSE PAGE (luggage tag only) ─────────────────────────────────
      if (hasReverse) {
        doc.addPage({ size: [pageWPt, pageHPt], margin: 0 });
        drawLuggageTagReverse(doc, bleedPt, trimWPt, trimHPt);
        drawCutContour(doc, bleedPt, trimWPt, trimHPt);
      }
    }

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }
}

// ── Drawing helpers ──────────────────────────────────────────────────────────

const ORANGE = '#FF7B14';
const FOX_RED = '#E8392B';
const CHARCOAL = '#232323';
const CREAM = '#F5F0E8';

function getAccent(mode: QrMode): string {
  return mode === 'emergency' ? FOX_RED : ORANGE;
}

function drawCutContour(
  doc: any,
  bleedPt: number,
  trimWPt: number,
  trimHPt: number,
): void {
  doc
    .save()
    .dash(3, { space: 3 })
    .rect(bleedPt, bleedPt, trimWPt, trimHPt)
    .stroke('#FF00FF') // magenta = CutContour spot colour convention
    .restore();
}

// ── Standard card formats (name-tag, square, item-sticker, item-mini, etc.) ──

function drawStandardFront(
  doc: any,
  fmt: (typeof PRINT_FORMATS)[PrintFormatKey],
  bleedPt: number,
  trimWPt: number,
  trimHPt: number,
  qrBuf: Buffer,
  _qrPx: number,
  uniqueCode: string,
  formatKey: string,
): void {
  const accent = getAccent(fmt.mode);
  const safePt = mmToPt(fmt.safeMm);
  const innerH = trimHPt - safePt * 2;

  // White background (full bleed area)
  doc.rect(0, 0, trimWPt + bleedPt * 2, trimHPt + bleedPt * 2).fill('#ffffff');

  // Accent bar — top strip
  const barH = Math.min(mmToPt(6), innerH * 0.18);
  doc.rect(bleedPt, bleedPt, trimWPt, barH).fill(accent);

  // Fox symbol text (unicode fox emoji placeholder if no svg — real fox is in QR)
  // Brand label
  doc
    .font('Helvetica-Bold')
    .fontSize(Math.min(4.5, trimWPt * 0.055))
    .fillColor(accent)
    .text('THEWILEYFOX', bleedPt + safePt, bleedPt + barH + 2, {
      width: trimWPt - safePt * 2,
      align: formatKey === 'name-tag' ? 'left' : 'center',
    });

  // QR image — centred in remaining space
  const qrPt = mmToPt(fmt.minQrMm);
  const qrX = bleedPt + (trimWPt - qrPt) / 2;

  // Available height below bar + brand label
  const labelH = mmToPt(4);
  const codeH = mmToPt(3.5);
  const usedTop = barH + labelH + mmToPt(1);
  const usedBottom = codeH + mmToPt(1.5);
  const availH = trimHPt - usedTop - usedBottom;
  const qrY = bleedPt + usedTop + (availH - qrPt) / 2;

  doc.image(qrBuf, qrX, qrY, { width: qrPt, height: qrPt });

  // Unique code below QR
  doc
    .font('Helvetica')
    .fontSize(Math.min(4, trimWPt * 0.048))
    .fillColor(CHARCOAL)
    .text(uniqueCode, bleedPt + safePt, qrY + qrPt + mmToPt(1), {
      width: trimWPt - safePt * 2,
      align: 'center',
      characterSpacing: 0.5,
    });

  // Scan-frame chevrons bottom-right (L&F mode only)
  if (fmt.mode === 'lost-found') {
    doc
      .font('Helvetica-Bold')
      .fontSize(Math.min(5, trimWPt * 0.06))
      .fillColor(accent)
      .text('>>>', bleedPt + trimWPt - safePt - mmToPt(7), bleedPt + trimHPt - safePt - mmToPt(4), {
        width: mmToPt(7),
        align: 'right',
      });
  } else {
    // Emergency cross mark
    const crossSize = mmToPt(3.5);
    const cx = bleedPt + trimWPt - safePt - crossSize;
    const cy = bleedPt + trimHPt - safePt - crossSize;
    const arm = crossSize * 0.28;
    doc.rect(cx + arm, cy, crossSize - arm * 2, crossSize).fill(accent);
    doc.rect(cx, cy + arm, crossSize, crossSize - arm * 2).fill(accent);
  }
}

// ── Wristband (hospital + event/kids) ────────────────────────────────────────

function drawWristbandFront(
  doc: any,
  fmt: (typeof PRINT_FORMATS)[PrintFormatKey],
  bleedPt: number,
  trimWPt: number,
  trimHPt: number,
  qrBuf: Buffer,
  _qrPx: number,
  uniqueCode: string,
): void {
  const accent = getAccent(fmt.mode);
  const safePt = mmToPt(fmt.safeMm);
  const isEvent = fmt.mode === 'lost-found';

  // Background
  if (isEvent) {
    doc.rect(0, 0, trimWPt + bleedPt * 2, trimHPt + bleedPt * 2).fill(ORANGE);
  } else {
    doc.rect(0, 0, trimWPt + bleedPt * 2, trimHPt + bleedPt * 2).fill('#ffffff');
    // Hospital: thin accent border top+bottom
    doc.rect(bleedPt, bleedPt, trimWPt, mmToPt(1.5)).fill(FOX_RED);
    doc.rect(bleedPt, bleedPt + trimHPt - mmToPt(1.5), trimWPt, mmToPt(1.5)).fill(FOX_RED);
  }

  // QR — left side
  const qrPt = mmToPt(fmt.minQrMm);
  const qrX = bleedPt + safePt;
  const qrY = bleedPt + (trimHPt - qrPt) / 2;
  doc.image(qrBuf, qrX, qrY, { width: qrPt, height: qrPt });

  // Symbol (cross or chevrons) — right of QR
  const symX = qrX + qrPt + mmToPt(2);
  const symSize = mmToPt(6);
  const symY = bleedPt + (trimHPt - symSize) / 2;

  if (!isEvent) {
    const arm = symSize * 0.25;
    doc.rect(symX + arm, symY, symSize - arm * 2, symSize).fill(FOX_RED);
    doc.rect(symX, symY + arm, symSize, symSize - arm * 2).fill(FOX_RED);
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(mmToPt(5))
      .fillColor('white')
      .text('>>>', symX, bleedPt + (trimHPt - mmToPt(5)) / 2, { width: mmToPt(10), align: 'left' });
  }

  // Brand + code — centre region
  const textX = symX + mmToPt(12);
  const textW = trimWPt - (textX - bleedPt) - safePt;
  const textColor = isEvent ? 'white' : CHARCOAL;

  doc
    .font('Helvetica-Bold')
    .fontSize(mmToPt(3.5))
    .fillColor(isEvent ? 'white' : accent)
    .text('THEWILEYFOX', textX, bleedPt + trimHPt * 0.22, { width: textW, align: 'left' });

  doc
    .font('Helvetica')
    .fontSize(mmToPt(3))
    .fillColor(textColor)
    .text('Scan to reunite', textX, bleedPt + trimHPt * 0.44, { width: textW, align: 'left' });

  doc
    .font('Helvetica')
    .fontSize(mmToPt(2.8))
    .fillColor(isEvent ? 'rgba(255,255,255,0.75)' : '#888888')
    .text(uniqueCode, textX, bleedPt + trimHPt * 0.65, {
      width: textW,
      align: 'left',
      characterSpacing: 0.5,
    });

  // Adhesive tab indicator on right edge
  const tabW = mmToPt(8);
  doc
    .rect(bleedPt + trimWPt - tabW, bleedPt, tabW, trimHPt)
    .fill(isEvent ? 'rgba(0,0,0,0.12)' : '#f0f0f0');
  doc
    .font('Helvetica')
    .fontSize(mmToPt(2))
    .fillColor(isEvent ? 'rgba(255,255,255,0.6)' : '#aaaaaa')
    .text('TAB', bleedPt + trimWPt - tabW + mmToPt(1), bleedPt + (trimHPt - mmToPt(2.5)) / 2, {
      width: tabW - mmToPt(2),
      align: 'center',
    });
}

// ── Luggage tag front ─────────────────────────────────────────────────────────

function drawLuggageTagFront(
  doc: any,
  fmt: (typeof PRINT_FORMATS)[PrintFormatKey],
  bleedPt: number,
  trimWPt: number,
  trimHPt: number,
  qrBuf: Buffer,
  _qrPx: number,
  uniqueCode: string,
): void {
  const safePt = mmToPt(fmt.safeMm);

  // Cream background
  doc.rect(0, 0, trimWPt + bleedPt * 2, trimHPt + bleedPt * 2).fill(CREAM);

  // Orange header band
  const headerH = mmToPt(14);
  doc.rect(bleedPt, bleedPt, trimWPt, headerH).fill(ORANGE);

  // Grommet hole indicator (top centre)
  const grommDiam = mmToPt(5);
  const grommX = bleedPt + (trimWPt - grommDiam) / 2;
  doc
    .circle(grommX + grommDiam / 2, bleedPt + grommDiam / 2 + mmToPt(1), grommDiam / 2)
    .fill('#ffffff');

  // Brand in header
  doc
    .font('Helvetica-Bold')
    .fontSize(mmToPt(4.5))
    .fillColor('white')
    .text('THEWILEYFOX', bleedPt + safePt, bleedPt + headerH * 0.55, {
      width: trimWPt - safePt * 2,
      align: 'center',
    });

  // "LOST & FOUND" sub-label
  doc
    .font('Helvetica')
    .fontSize(mmToPt(2.8))
    .fillColor('rgba(255,255,255,0.85)')
    .text('LOST & FOUND', bleedPt + safePt, bleedPt + headerH * 0.72, {
      width: trimWPt - safePt * 2,
      align: 'center',
      characterSpacing: 1,
    });

  // QR — centred below header
  const qrPt = mmToPt(fmt.minQrMm);
  const qrX = bleedPt + (trimWPt - qrPt) / 2;
  const qrY = bleedPt + headerH + mmToPt(4);
  doc.image(qrBuf, qrX, qrY, { width: qrPt, height: qrPt });

  // Unique code
  doc
    .font('Helvetica')
    .fontSize(mmToPt(3))
    .fillColor(CHARCOAL)
    .text(uniqueCode, bleedPt + safePt, qrY + qrPt + mmToPt(2), {
      width: trimWPt - safePt * 2,
      align: 'center',
      characterSpacing: 0.8,
    });

  // "Scan to return" line
  doc
    .font('Helvetica-Bold')
    .fontSize(mmToPt(3.5))
    .fillColor(CHARCOAL)
    .text('If it\'s lost, scan to return.', bleedPt + safePt, qrY + qrPt + mmToPt(7), {
      width: trimWPt - safePt * 2,
      align: 'center',
    });

  // Chevrons bottom
  doc
    .font('Helvetica-Bold')
    .fontSize(mmToPt(5))
    .fillColor(ORANGE)
    .text('>>>', bleedPt + safePt, bleedPt + trimHPt - safePt - mmToPt(6), {
      width: trimWPt - safePt * 2,
      align: 'center',
    });
}

// ── Luggage tag reverse (writable) ───────────────────────────────────────────

function drawLuggageTagReverse(
  doc: any,
  bleedPt: number,
  trimWPt: number,
  trimHPt: number,
): void {
  const safePt = mmToPt(4);

  doc.rect(0, 0, trimWPt + bleedPt * 2, trimHPt + bleedPt * 2).fill('#ffffff');

  // Orange thin top band
  doc.rect(bleedPt, bleedPt, trimWPt, mmToPt(3)).fill(ORANGE);

  // Grommet hole
  const grommDiam = mmToPt(5);
  doc
    .circle(bleedPt + trimWPt / 2, bleedPt + grommDiam / 2 + mmToPt(1), grommDiam / 2)
    .fill(ORANGE);

  const labelFontSize = mmToPt(2.3);
  const lineH = mmToPt(7);
  const startY = bleedPt + mmToPt(8);
  const fieldX = bleedPt + safePt;
  const fieldW = trimWPt - safePt * 2;

  const fields = ['NAME', 'PHONE', 'EMAIL', 'ADDRESS', 'CITY / COUNTRY'];

  fields.forEach((label, i) => {
    const y = startY + i * lineH;

    // Label
    doc
      .font('Helvetica-Bold')
      .fontSize(labelFontSize)
      .fillColor('#999999')
      .text(label, fieldX, y, { width: fieldW, align: 'left', characterSpacing: 0.5 });

    // Writable line
    doc
      .moveTo(fieldX, y + mmToPt(4.2))
      .lineTo(fieldX + fieldW, y + mmToPt(4.2))
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .stroke();
  });

  // "Or scan the QR on the front" footer
  doc
    .font('Helvetica')
    .fontSize(mmToPt(2.5))
    .fillColor('#aaaaaa')
    .text('Or scan the QR on the front — no app needed.', fieldX, bleedPt + trimHPt - safePt - mmToPt(5), {
      width: fieldW,
      align: 'center',
    });
}
