'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Package,
  Plus,
  FileText,
  Archive,
  Printer,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  admin,
  type AdminQrBatch,
  type AdminQrBatchDetail,
  type PrintFormatSpec,
} from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';

// ── helpers ───────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ── Generate form ─────────────────────────────────────────────────────────────

function GenerateForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(10);
  const [shopifyOrderId, setShopifyOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (count < 1 || count > 500) { setError('Count must be 1–500'); return; }
    setLoading(true);
    setError('');
    try {
      await admin.bulkGenerateQr({
        count,
        shopifyOrderId: shopifyOrderId.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setOpen(false);
      setCount(10);
      setShopifyOrderId('');
      setNotes('');
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate batch');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg admin-accent-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        <Plus className="h-4 w-4" />
        Generate Batch
      </button>
    );
  }

  return (
    <div className="rounded-xl border admin-border-color admin-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold admin-text-color">Generate New Batch</h3>
        <button onClick={() => setOpen(false)} className="text-xs admin-text-subtle hover:admin-text-color">Cancel</button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium admin-text-subtle mb-1">Count (1–500)</label>
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full rounded-lg border admin-border-color admin-surface admin-text-color px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium admin-text-subtle mb-1">Shopify Order ID (optional)</label>
            <input
              type="text"
              maxLength={100}
              value={shopifyOrderId}
              onChange={(e) => setShopifyOrderId(e.target.value)}
              placeholder="ORD-12345"
              className="w-full rounded-lg border admin-border-color admin-surface admin-text-color px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:admin-text-subtle"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium admin-text-subtle mb-1">Notes (optional)</label>
          <input
            type="text"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Q3 retail batch"
            className="w-full rounded-lg border admin-border-color admin-surface admin-text-color px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:admin-text-subtle"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg admin-accent-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Print download modal ──────────────────────────────────────────────────────

function PrintDownloadModal({
  batchId,
  formats,
  onClose,
}: {
  batchId: string;
  formats: PrintFormatSpec[];
  onClose: () => void;
}) {
  const [selectedFormat, setSelectedFormat] = useState(formats[0]?.key ?? '');
  const [foxQr, setFoxQr] = useState(true);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const result = await admin.downloadBatchPrint(batchId, selectedFormat, foxQr);
      triggerDownload(result.blob, result.filename);
      onClose();
    } catch (err: any) {
      alert(err?.message ?? 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  const fmt = formats.find((f) => f.key === selectedFormat);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="admin-surface rounded-2xl border admin-border-color shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b admin-border-color">
          <h2 className="text-sm font-semibold admin-text-color flex items-center gap-2">
            <Printer className="h-4 w-4 admin-accent-text" />
            Print-Ready Export
          </h2>
          <button onClick={onClose} className="admin-text-subtle hover:admin-text-muted text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Format selector */}
          <div>
            <label className="block text-xs font-medium admin-text-subtle mb-2">Format</label>
            <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {formats.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setSelectedFormat(f.key)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selectedFormat === f.key
                      ? 'border-orange-500 bg-orange-500/10 admin-text-color'
                      : 'admin-border-color admin-text-muted admin-hover'
                  }`}
                >
                  <div>
                    <span className="font-medium">{f.label}</span>
                    {f.hasReverse && (
                      <span className="ml-1.5 text-[10px] rounded-full bg-blue-500/10 text-blue-400 px-1.5 py-0.5">
                        + reverse
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] admin-text-subtle font-mono">
                    {f.trimMm.w}×{f.trimMm.h}mm
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Specs row */}
          {fmt && (
            <div className="rounded-lg border admin-border-color px-3 py-2 flex items-center gap-4 text-xs admin-text-subtle">
              <span>
                Mode:{' '}
                <span className={fmt.mode === 'emergency' ? 'text-red-400' : 'text-orange-400'}>
                  {fmt.mode === 'emergency' ? 'Emergency' : 'Lost & Found'}
                </span>
              </span>
              <span>Min QR: {fmt.minQrMm}mm</span>
              <span>PDF/X-1a · 300dpi</span>
            </div>
          )}

          {/* Fox QR toggle */}
          <label className="flex items-center justify-between rounded-lg border admin-border-color px-3 py-2.5 cursor-pointer admin-hover">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-400" />
              <div>
                <p className="text-sm font-medium admin-text-color">Fox QR</p>
                <p className="text-[10px] admin-text-subtle">Embed fox logo in QR centre</p>
              </div>
            </div>
            <div
              onClick={() => setFoxQr((v) => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${foxQr ? 'bg-orange-500' : 'admin-surface-raised border admin-border-color'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${foxQr ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t admin-border-color">
          <button onClick={onClose} className="text-sm admin-text-muted px-3 py-1.5 rounded-lg admin-hover">
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || !selectedFormat}
            className="inline-flex items-center gap-2 rounded-lg admin-accent-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {downloading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Batch row ─────────────────────────────────────────────────────────────────

function BatchRow({
  batch,
  formats,
}: {
  batch: AdminQrBatch;
  formats: PrintFormatSpec[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<AdminQrBatchDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'zip' | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  async function toggleExpand() {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const d = await admin.getBatch(batch.id);
        setDetail(d);
      } finally {
        setLoadingDetail(false);
      }
    }
    setExpanded((v) => !v);
  }

  async function download(type: 'pdf' | 'zip') {
    setDownloading(type);
    try {
      const result =
        type === 'pdf'
          ? await admin.downloadBatchPdf(batch.id)
          : await admin.downloadBatchZip(batch.id);
      triggerDownload(result.blob, result.filename);
    } catch (err: any) {
      alert(err?.message ?? 'Download failed');
    } finally {
      setDownloading(null);
    }
  }

  const adminName = batch.adminFirstName
    ? `${batch.adminFirstName} ${batch.adminLastName ?? ''}`.trim()
    : batch.adminEmail ?? '—';

  return (
    <>
      <div className="rounded-xl border admin-border-color admin-surface overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-3">
          <button
            onClick={toggleExpand}
            className="flex-shrink-0 admin-text-subtle hover:admin-text-color transition-colors"
          >
            {loadingDetail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg admin-accent-bg-dim">
            <Package className="h-4 w-4 admin-accent-text" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold admin-text-color">{batch.count} codes</span>
              {batch.shopifyOrderId && (
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                  {batch.shopifyOrderId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs admin-text-subtle flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {fmtDate(batch.createdAt)}
              </span>
              <span className="text-xs admin-text-subtle">by {adminName}</span>
              {batch.notes && (
                <span className="text-xs admin-text-subtle truncate max-w-[200px]">{batch.notes}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Print-ready export */}
            <button
              onClick={() => setShowPrintModal(true)}
              disabled={downloading !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border admin-border-color px-3 py-1.5 text-xs font-medium admin-text-muted admin-hover disabled:opacity-50 transition-colors"
              title="Print-ready PDF (with format & fox QR options)"
            >
              <Printer className="h-3 w-3" />
              Print
            </button>
            {/* Quick PDF (grid) */}
            <button
              onClick={() => download('pdf')}
              disabled={downloading !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border admin-border-color px-3 py-1.5 text-xs font-medium admin-text-muted admin-hover disabled:opacity-50 transition-colors"
              title="Quick grid PDF"
            >
              {downloading === 'pdf' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <FileText className="h-3 w-3" />
              )}
              PDF
            </button>
            {/* ZIP */}
            <button
              onClick={() => download('zip')}
              disabled={downloading !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border admin-border-color px-3 py-1.5 text-xs font-medium admin-text-muted admin-hover disabled:opacity-50 transition-colors"
              title="ZIP of individual PNGs"
            >
              {downloading === 'zip' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Archive className="h-3 w-3" />
              )}
              ZIP
            </button>
          </div>
        </div>

        {/* Expanded codes list */}
        {expanded && detail && (
          <div className="border-t admin-border-color px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest admin-text-subtle mb-2">
              QR Codes · {detail.codes.length}
            </p>
            <div className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {detail.codes.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-1.5 rounded-md border admin-border-color px-2 py-1"
                >
                  {c.status === 'unclaimed' ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 text-blue-400 flex-shrink-0" />
                  )}
                  <span className="font-mono text-[10px] admin-text-color">{c.uniqueCode}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showPrintModal && (
        <PrintDownloadModal
          batchId={batch.id}
          formats={formats}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QrBatchesPage() {
  const [batches, setBatches] = useState<AdminQrBatch[]>([]);
  const [formats, setFormats] = useState<PrintFormatSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const load = useCallback(() => {
    setLoading(true);
    admin
      .listBatches(limit, offset)
      .then(setBatches)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    admin.listPrintFormats().then(setFormats).catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <AdminPageHeader
          title="QR Batches"
          description="Generate and export batches of unclaimed QR tags. Use Print for format-specific print-ready PDFs."
        />
        <div className="flex-shrink-0 pt-1">
          <GenerateForm onCreated={() => { setOffset(0); load(); }} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin admin-text-subtle" />
        </div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl admin-accent-bg-dim">
            <Package className="h-6 w-6 admin-accent-text" />
          </div>
          <p className="text-sm font-medium admin-text-color">No batches yet</p>
          <p className="text-xs admin-text-subtle">Generate your first batch to produce unclaimed QR tags.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {batches.map((b) => (
              <BatchRow key={b.id} batch={b} formats={formats} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              disabled={offset === 0}
              className="rounded-lg border admin-border-color px-3 py-1.5 text-xs admin-text-muted admin-hover disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs admin-text-subtle">
              Showing {offset + 1}–{offset + batches.length}
            </span>
            <button
              onClick={() => setOffset((o) => o + limit)}
              disabled={batches.length < limit}
              className="rounded-lg border admin-border-color px-3 py-1.5 text-xs admin-text-muted admin-hover disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
