/**
 * Standalone test script — generates one print-ready PDF per format type.
 * No NestJS, no DB. Uses fake QR codes to validate layout/rendering.
 *
 * Usage:
 *   cd safetag/apps/backend
 *   ../../node_modules/.bin/ts-node --transpile-only scripts/test-print-formats.ts
 *
 * Output: scripts/output/test-<format>.pdf  (one per format + fox/no-fox variants)
 */

import * as path from 'path';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { generateFoxQr, type QrMode } from '../src/modules/admin/fox-qr.util';

// ── Inline constants (mirrors print-export.service.ts) ──────────────────────

const MM_TO_PT = 2.8346;
const DPI = 300;

function mmToPt(mm: number): number { return mm * MM_TO_PT; }
function mmToPx(mm: number): number { return Math.round(mm * (DPI / 25.4)); }

const ORANGE = '#FF7B14';
const FOX_RED = '#E8392B';
const CHARCOAL = '#232323';
const CREAM = '#F5F0E8';

function getAccent(mode: QrMode): string {
  return mode === 'emergency' ? FOX_RED : ORANGE;
}

// ── Format table ─────────────────────────────────────────────────────────────

const FORMATS = {
  'name-tag-emergency':  { label: 'Name Tag (Emergency)',          trimMm: { w: 64,  h: 30  }, bleedMm: 0, safeMm: 3, minQrMm: 18, mode: 'emergency'  as QrMode },
  'name-tag-square':     { label: 'Name Tag (Square)',             trimMm: { w: 45,  h: 45  }, bleedMm: 0, safeMm: 3, minQrMm: 18, mode: 'lost-found' as QrMode },
  'item-sticker':        { label: 'Item Sticker',                  trimMm: { w: 50,  h: 25  }, bleedMm: 0, safeMm: 2, minQrMm: 15, mode: 'lost-found' as QrMode },
  'item-mini':           { label: 'Item Mini',                     trimMm: { w: 30,  h: 30  }, bleedMm: 0, safeMm: 2, minQrMm: 15, mode: 'lost-found' as QrMode },
  'luggage-tag':         { label: 'Luggage Tag',                   trimMm: { w: 54,  h: 90  }, bleedMm: 0, safeMm: 4, minQrMm: 20, mode: 'lost-found' as QrMode, hasReverse: true },
  'keyring':             { label: 'Keyring',                       trimMm: { w: 38,  h: 44  }, bleedMm: 0, safeMm: 3, minQrMm: 15, mode: 'lost-found' as QrMode, hasReverse: true },
  'wristband-medical':   { label: 'Wristband (Medical)',           trimMm: { w: 250, h: 25  }, bleedMm: 0, safeMm: 4, minQrMm: 14, mode: 'emergency'  as QrMode },
  'wristband-event':     { label: 'Wristband (Event / Kids)',      trimMm: { w: 250, h: 25  }, bleedMm: 0, safeMm: 4, minQrMm: 14, mode: 'lost-found' as QrMode },
  'luggage-bar':         { label: 'Luggage Bar',                   trimMm: { w: 90,  h: 35  }, bleedMm: 3, safeMm: 3, minQrMm: 16, mode: 'lost-found' as QrMode },
} as const;

type FormatKey = keyof typeof FORMATS;

// ── Drawing helpers (duplicated from service — intentional for standalone use) ─

function drawCutContour(doc: any, bleedPt: number, trimWPt: number, trimHPt: number): void {
  doc.save().dash(3, { space: 3 }).rect(bleedPt, bleedPt, trimWPt, trimHPt).stroke('#FF00FF').restore();
}

function drawStandardFront(
  doc: any, fmt: (typeof FORMATS)[FormatKey], bleedPt: number,
  trimWPt: number, trimHPt: number, qrBuf: Buffer, uniqueCode: string, formatKey: string,
): void {
  const accent = getAccent(fmt.mode);
  const safePt = mmToPt(fmt.safeMm);

  doc.rect(0, 0, trimWPt + bleedPt * 2, trimHPt + bleedPt * 2).fill('#ffffff');

  const innerH = trimHPt - safePt * 2;
  const barH = Math.min(mmToPt(6), innerH * 0.18);
  doc.rect(bleedPt, bleedPt, trimWPt, barH).fill(accent);

  doc
    .font('Helvetica-Bold')
    .fontSize(Math.min(4.5, trimWPt * 0.055))
    .fillColor(accent)
    .text('THEWILEYFOX', bleedPt + safePt, bleedPt + barH + 2, {
      width: trimWPt - safePt * 2,
      align: formatKey === 'name-tag-emergency' ? 'left' : 'center',
    });

  const qrPt = mmToPt(fmt.minQrMm);
  const qrX = bleedPt + (trimWPt - qrPt) / 2;
  const labelH = mmToPt(4);
  const codeH = mmToPt(3.5);
  const usedTop = barH + labelH + mmToPt(1);
  const usedBottom = codeH + mmToPt(1.5);
  const availH = trimHPt - usedTop - usedBottom;
  const qrY = bleedPt + usedTop + (availH - qrPt) / 2;

  doc.image(qrBuf, qrX, qrY, { width: qrPt, height: qrPt });

  doc
    .font('Helvetica')
    .fontSize(Math.min(4, trimWPt * 0.048))
    .fillColor(CHARCOAL)
    .text(uniqueCode, bleedPt + safePt, qrY + qrPt + mmToPt(1), {
      width: trimWPt - safePt * 2,
      align: 'center',
      characterSpacing: 0.5,
    });

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
    const crossSize = mmToPt(3.5);
    const cx = bleedPt + trimWPt - safePt - crossSize;
    const cy = bleedPt + trimHPt - safePt - crossSize;
    const arm = crossSize * 0.28;
    doc.rect(cx + arm, cy, crossSize - arm * 2, crossSize).fill(accent);
    doc.rect(cx, cy + arm, crossSize, crossSize - arm * 2).fill(accent);
  }
}

function drawWristbandFront(
  doc: any, fmt: (typeof FORMATS)[FormatKey], bleedPt: number,
  trimWPt: number, trimHPt: number, qrBuf: Buffer, uniqueCode: string,
): void {
  const accent = getAccent(fmt.mode);
  const safePt = mmToPt(fmt.safeMm);
  const isEvent = fmt.mode === 'lost-found';

  if (isEvent) {
    doc.rect(0, 0, trimWPt + bleedPt * 2, trimHPt + bleedPt * 2).fill(ORANGE);
  } else {
    doc.rect(0, 0, trimWPt + bleedPt * 2, trimHPt + bleedPt * 2).fill('#ffffff');
    doc.rect(bleedPt, bleedPt, trimWPt, mmToPt(1.5)).fill(FOX_RED);
    doc.rect(bleedPt, bleedPt + trimHPt - mmToPt(1.5), trimWPt, mmToPt(1.5)).fill(FOX_RED);
  }

  const qrPt = mmToPt(fmt.minQrMm);
  const qrX = bleedPt + safePt;
  const qrY = bleedPt + (trimHPt - qrPt) / 2;
  doc.image(qrBuf, qrX, qrY, { width: qrPt, height: qrPt });

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

function drawLuggageTagFront(
  doc: any, fmt: (typeof FORMATS)[FormatKey], bleedPt: number,
  trimWPt: number, trimHPt: number, qrBuf: Buffer, uniqueCode: string,
): void {
  const safePt = mmToPt(fmt.safeMm);

  doc.rect(0, 0, trimWPt + bleedPt * 2, trimHPt + bleedPt * 2).fill(CREAM);

  const headerH = mmToPt(14);
  doc.rect(bleedPt, bleedPt, trimWPt, headerH).fill(ORANGE);

  const grommDiam = mmToPt(5);
  const grommX = bleedPt + (trimWPt - grommDiam) / 2;
  doc.circle(grommX + grommDiam / 2, bleedPt + grommDiam / 2 + mmToPt(1), grommDiam / 2).fill('#ffffff');

  doc
    .font('Helvetica-Bold')
    .fontSize(mmToPt(4.5))
    .fillColor('white')
    .text('THEWILEYFOX', bleedPt + safePt, bleedPt + headerH * 0.55, {
      width: trimWPt - safePt * 2,
      align: 'center',
    });

  doc
    .font('Helvetica')
    .fontSize(mmToPt(2.8))
    .fillColor('rgba(255,255,255,0.85)')
    .text('LOST & FOUND', bleedPt + safePt, bleedPt + headerH * 0.72, {
      width: trimWPt - safePt * 2,
      align: 'center',
      characterSpacing: 1,
    });

  const qrPt = mmToPt(fmt.minQrMm);
  const qrX = bleedPt + (trimWPt - qrPt) / 2;
  const qrY = bleedPt + headerH + mmToPt(4);
  doc.image(qrBuf, qrX, qrY, { width: qrPt, height: qrPt });

  doc
    .font('Helvetica')
    .fontSize(mmToPt(3))
    .fillColor(CHARCOAL)
    .text(uniqueCode, bleedPt + safePt, qrY + qrPt + mmToPt(2), {
      width: trimWPt - safePt * 2,
      align: 'center',
      characterSpacing: 0.8,
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(mmToPt(3.5))
    .fillColor(CHARCOAL)
    .text("If it's lost, scan to return.", bleedPt + safePt, qrY + qrPt + mmToPt(7), {
      width: trimWPt - safePt * 2,
      align: 'center',
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(mmToPt(5))
    .fillColor(ORANGE)
    .text('>>>', bleedPt + safePt, bleedPt + trimHPt - safePt - mmToPt(6), {
      width: trimWPt - safePt * 2,
      align: 'center',
    });
}

function drawLuggageTagReverse(
  doc: any, bleedPt: number, trimWPt: number, trimHPt: number, qrBuf: Buffer
): void {
  const safePt = mmToPt(4);
  
  // Background
  doc.rect(0, 0, trimWPt + bleedPt * 2, trimHPt + bleedPt * 2).fill('#F2F4E5');

  // Grommet at top center
  const grommDiam = mmToPt(5.2);
  const gx = bleedPt + trimWPt / 2;
  const gy = bleedPt + grommDiam / 2 + mmToPt(1.2);
  doc.circle(gx, gy, grommDiam / 2).fill('#E5EBD3').stroke('#D6DEC2');

  const labelFontSize = mmToPt(2.2);
  const lineH = mmToPt(7.5);
  const startY = bleedPt + mmToPt(16.5);
  const fieldX = bleedPt + safePt;
  const fieldW = trimWPt - safePt * 2;

  // Title
  doc
    .font('Helvetica-Bold')
    .fontSize(mmToPt(2.4))
    .fillColor(ORANGE)
    .text('IF FOUND, PLEASE CONTACT', fieldX, startY - mmToPt(7), {
      width: fieldW,
      align: 'left',
      characterSpacing: 0.5,
    });

  // Fields
  const fields = ['NAME', 'PHONE', 'EMAIL', 'ADDRESS'];
  fields.forEach((label, i) => {
    const y = startY + i * lineH;
    doc
      .font('Helvetica-Bold')
      .fontSize(labelFontSize)
      .fillColor('#9AA889')
      .text(label, fieldX, y, { width: fieldW, align: 'left', characterSpacing: 0.5 });
    doc
      .moveTo(fieldX, y + mmToPt(3.8))
      .lineTo(fieldX + fieldW, y + mmToPt(3.8))
      .strokeColor('#CBD3B5')
      .lineWidth(0.5)
      .stroke();
  });

  // Extra line for address
  const extraLineY = startY + fields.length * lineH;
  doc
    .moveTo(fieldX, extraLineY)
    .lineTo(fieldX + fieldW, extraLineY)
    .strokeColor('#CBD3B5')
    .lineWidth(0.5)
    .stroke();

  // Bottom box for QR
  const boxW = trimWPt - mmToPt(1.5) * 2;
  const boxH = mmToPt(16);
  const boxX = bleedPt + mmToPt(1.5);
  const boxY = bleedPt + trimHPt - boxH - mmToPt(8);
  doc.roundedRect(boxX, boxY, boxW, boxH, 4).fill('#E5EBD3');

  // QR inside bottom box
  const qrSize = mmToPt(11.6);
  const qrX = boxX + mmToPt(2);
  const qrY = boxY + (boxH - qrSize) / 2;
  doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });

  // Text next to QR
  doc
    .font('Helvetica-Bold')
    .fontSize(mmToPt(2))
    .fillColor(CHARCOAL)
    .text('Or scan — reach me', qrX + qrSize + mmToPt(2.5), qrY + mmToPt(2.5), {
      width: boxW - qrSize - mmToPt(6),
      align: 'left',
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(mmToPt(2))
    .fillColor(CHARCOAL)
    .text('instantly, no signal needed.', qrX + qrSize + mmToPt(2.5), qrY + mmToPt(5.3), {
      width: boxW - qrSize - mmToPt(6),
      align: 'left',
    });
}

// ── Fake QR (plain qrcode lib, no DB) ────────────────────────────────────────

async function makePlainQr(url: string, sizePx: number): Promise<Buffer> {
  const QRCode = require('qrcode');
  return QRCode.toBuffer(url, {
    type: 'png',
    width: sizePx,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// ── PDF builder ───────────────────────────────────────────────────────────────

async function buildFormatPdf(
  formatKey: FormatKey,
  useFox: boolean,
  fakeCode: string,
): Promise<Buffer> {
  const fmt = FORMATS[formatKey];
  const isWristband = formatKey.startsWith('wristband');
  const hasReverse = 'hasReverse' in fmt && (fmt as any).hasReverse === true;

  const bleedPt = mmToPt(fmt.bleedMm);
  const trimWPt = mmToPt(fmt.trimMm.w);
  const trimHPt = mmToPt(fmt.trimMm.h);
  const pageWPt = trimWPt + bleedPt * 2;
  const pageHPt = trimHPt + bleedPt * 2;
  const qrPx = mmToPx(fmt.minQrMm);

  const scanUrl = `https://thewileyfox.com/q/${fakeCode}`;
  const qrBuf = useFox
    ? await generateFoxQr(scanUrl, qrPx, fmt.mode)
    : await makePlainQr(scanUrl, qrPx);

  const buffers: Buffer[] = [];
  const doc = new PDFDocument({
    autoFirstPage: false,
    compress: true,
    info: {
      Title: `SafeTag TEST — ${fmt.label}`,
      Author: 'TheWileyfox',
      Subject: `Test render (${useFox ? 'fox' : 'plain'} QR)`,
    },
  });
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  doc.addPage({ size: [pageWPt, pageHPt], margin: 0 });

  if (isWristband) {
    drawWristbandFront(doc, fmt, bleedPt, trimWPt, trimHPt, qrBuf, fakeCode);
  } else if (formatKey === 'luggage-tag') {
    drawLuggageTagFront(doc, fmt, bleedPt, trimWPt, trimHPt, qrBuf, fakeCode);
  } else {
    drawStandardFront(doc, fmt, bleedPt, trimWPt, trimHPt, qrBuf, fakeCode, formatKey);
  }

  drawCutContour(doc, bleedPt, trimWPt, trimHPt);

  if (hasReverse) {
    doc.addPage({ size: [pageWPt, pageHPt], margin: 0 });
    drawLuggageTagReverse(doc, bleedPt, trimWPt, trimHPt, qrBuf);
    drawCutContour(doc, bleedPt, trimWPt, trimHPt);
  }

  doc.end();
  return new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(buffers))));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });

  const formatKeys = Object.keys(FORMATS) as FormatKey[];

  // Fake codes — one per format, realistic alphanumeric pattern
  const fakeCodes = formatKeys.map((k, i) =>
    `TST-${String(i + 1).padStart(3, '0')}-${k.toUpperCase().slice(0, 4)}`,
  );

  console.log(`\nGenerating ${formatKeys.length * 2} PDFs (fox + plain variants each)...\n`);

  for (let i = 0; i < formatKeys.length; i++) {
    const key = formatKeys[i];
    const code = fakeCodes[i];
    const fmt = FORMATS[key];

    process.stdout.write(`  [${i + 1}/${formatKeys.length}] ${fmt.label.padEnd(28)} `);

    // Fox QR variant
    const foxPdf = await buildFormatPdf(key, true, code);
    const foxOut = path.join(outDir, `test-${key}-fox.pdf`);
    fs.writeFileSync(foxOut, foxPdf);
    process.stdout.write(`fox(${foxPdf.length}b) `);

    // Plain QR variant
    const plainPdf = await buildFormatPdf(key, false, code);
    const plainOut = path.join(outDir, `test-${key}-plain.pdf`);
    fs.writeFileSync(plainOut, plainPdf);
    process.stdout.write(`plain(${plainPdf.length}b) ✓\n`);
  }

  console.log(`\nAll PDFs written to: ${outDir}\n`);
  console.log('Files:');
  fs.readdirSync(outDir)
    .sort()
    .forEach((f) => {
      const size = fs.statSync(path.join(outDir, f)).size;
      console.log(`  ${f.padEnd(46)} ${(size / 1024).toFixed(1)} KB`);
    });
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
