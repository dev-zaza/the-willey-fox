'use client';

import { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import type { PrintTemplate, QrCode, TextSlots } from '@/lib/api';

interface PrintPreviewModalProps {
  template: PrintTemplate;
  qrCode: QrCode;
  apiBase: string;
  logoUrl?: string | null;
  onClose: () => void;
}

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  square: { width: 300, height: 300 },
  rectangle: { width: 400, height: 250 },
  wristband: { width: 500, height: 120 },
};

export function PrintPreviewModal({ template, qrCode, apiBase, logoUrl, onClose }: PrintPreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const slots = (template.textSlots ?? {}) as TextSlots;
  const dim = FORMAT_DIMENSIONS[template.formatType] ?? FORMAT_DIMENSIONS.square;

  function handlePrint() {
    const style = document.createElement('style');
    style.id = '__safetag_print_style';
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #safetag-print-area, #safetag-print-area * { visibility: visible !important; }
        #safetag-print-area { position: fixed !important; left: 0 !important; top: 0 !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    // Clean up after print dialog closes
    setTimeout(() => {
      const el = document.getElementById('__safetag_print_style');
      if (el) el.remove();
    }, 2000);
  }

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const qrImageUrl = `${apiBase}/qr-codes/${qrCode.id}/download`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white dark:bg-surface-card border border-surface-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <h2 className="text-base font-semibold text-white">Print Preview — {template.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview area */}
        <div className="flex items-center justify-center p-8 bg-slate-100 dark:bg-slate-800">
          <div id="safetag-print-area" ref={printRef}>
            <div
              style={{
                width: dim.width,
                height: dim.height,
                backgroundColor: template.backgroundColor,
                borderRadius: 12,
                border: '1px solid #ddd',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: template.qrPosition === 'top' ? 'flex-start'
                  : template.qrPosition === 'bottom' ? 'flex-end'
                  : 'center',
                padding: 16,
                gap: 8,
                position: 'relative',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                boxSizing: 'border-box',
              }}
            >
              {/* Logo placement */}
              {template.logoPlacement !== 'none' && (
                logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Logo"
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: template.logoPlacement === 'top-right' ? undefined : 12,
                      right: template.logoPlacement === 'top-right' ? 12 : undefined,
                      width: template.logoSize,
                      height: 'auto',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: template.logoPlacement === 'top-right' ? undefined : 12,
                      right: template.logoPlacement === 'top-right' ? 12 : undefined,
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#f97316',
                    }}
                  >
                    TheWileyfox
                  </div>
                )
              )}

              {/* Tag name above QR */}
              {slots.showTagName && slots.tagNamePosition === 'top' && (
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', textAlign: 'center', maxWidth: dim.width - 32 }}>
                  {qrCode.label ?? qrCode.name}
                </div>
              )}

              {/* QR Code image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="QR Code"
                width={template.qrSize}
                height={template.qrSize}
                style={{ borderRadius: 8, display: 'block' }}
              />

              {/* Tag name below QR */}
              {slots.showTagName && slots.tagNamePosition !== 'top' && (
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', textAlign: 'center', maxWidth: dim.width - 32 }}>
                  {qrCode.label ?? qrCode.name}
                </div>
              )}

              {/* Instructions */}
              {slots.showInstructions && slots.instructionsText && (
                <div style={{ fontSize: 11, color: '#555', textAlign: 'center', maxWidth: dim.width - 32 }}>
                  {String(slots.instructionsText)}
                </div>
              )}

              {/* Reward */}
              {slots.showReward && qrCode.rewardMessage && (
                <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, textAlign: 'center' }}>
                  Reward: {qrCode.rewardMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border">
          <p className="text-xs text-slate-500">
            Format: <span className="font-medium capitalize">{template.formatType}</span> ·
            Size: <span className="font-medium">{dim.width}×{dim.height}px</span>
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
