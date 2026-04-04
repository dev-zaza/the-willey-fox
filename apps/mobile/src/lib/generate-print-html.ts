import type { PrintTemplate } from '../services/tag-customization.service';
import type { QrCode } from '../services/qr.service';

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  square: { width: 300, height: 300 },
  rectangle: { width: 400, height: 250 },
  wristband: { width: 500, height: 120 },
};

/**
 * Builds a complete HTML string for printing via expo-print.
 * The QR code image is passed as a base64 data URI.
 */
export function buildPrintHtml(
  template: PrintTemplate,
  qrCode: QrCode,
  qrImageBase64: string,
  logoUrl?: string | null,
): string {
  const slots = template.textSlots ?? {};
  const dim = FORMAT_DIMENSIONS[template.formatType] ?? FORMAT_DIMENSIONS.square;
  const qrDataUri = qrImageBase64.startsWith('data:') ? qrImageBase64 : `data:image/png;base64,${qrImageBase64}`;

  // Logo is placed in the flex flow (top of card) so it doesn't overlap content
  const showLogo = template.logoPlacement !== 'none';
  const logoAlign = template.logoPlacement === 'top-right' ? 'flex-end' : template.logoPlacement === 'center' ? 'center' : 'flex-start';
  // Enforce a minimum display size of 48px so logo is always visible
  const logoDisplaySize = Math.max(template.logoSize ?? 40, 48);
  const logoHtml = showLogo
    ? logoUrl
      ? `<div style="width:100%;display:flex;justify-content:${logoAlign};margin-bottom:6px;">
           <img src="${logoUrl}" alt="Logo" style="width:${logoDisplaySize}px;height:${logoDisplaySize}px;object-fit:contain;" />
         </div>`
      : `<div style="width:100%;display:flex;justify-content:${logoAlign};margin-bottom:6px;">
           <span style="font-size:12px;font-weight:700;color:#f97316;">TheWileyfox</span>
         </div>`
    : '';

  const tagNameHtml = slots.showTagName
    ? `<div style="font-size:14px;font-weight:700;color:#111;text-align:center;max-width:${dim.width - 32}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(qrCode.name)}</div>`
    : '';

  const instructionsHtml = slots.showInstructions && slots.instructionsText
    ? `<div style="font-size:11px;color:#555;text-align:center;">${escapeHtml(slots.instructionsText)}</div>`
    : '';

  const rewardHtml = slots.showReward && qrCode.rewardMessage
    ? `<div style="font-size:11px;color:#22c55e;font-weight:600;text-align:center;">Reward: ${escapeHtml(qrCode.rewardMessage)}</div>`
    : '';

  const justify =
    template.qrPosition === 'top'
      ? 'flex-start'
      : template.qrPosition === 'bottom'
        ? 'flex-end'
        : 'center';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TheWileyfox Tag — ${escapeHtml(qrCode.name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f0f0f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .card {
      width: ${dim.width}px;
      min-height: ${dim.height}px;
      background-color: ${template.backgroundColor};
      border-radius: 12px;
      border: 1px solid #ddd;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: ${justify};
      padding: 16px;
      gap: 8px;
    }
    @media print {
      body { background: none; min-height: auto; }
      .card { border: 1px solid #ccc; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    ${logoHtml}
    ${slots.tagNamePosition === 'top' ? tagNameHtml : ''}
    <img src="${qrDataUri}" width="${template.qrSize}" height="${template.qrSize}" style="border-radius:8px;display:block;" alt="QR Code" />
    ${slots.tagNamePosition !== 'top' ? tagNameHtml : ''}
    ${instructionsHtml}
    ${rewardHtml}
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
