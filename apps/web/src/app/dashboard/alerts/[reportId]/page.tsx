'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { reports, qrCodes, type Report, type QrCode } from '@/lib/api';

export default function AlertDetailPage() {
  const params = useParams<{ reportId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [tag, setTag] = useState<QrCode | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.reportId) return;
    reports
      .get(params.reportId)
      .then(async (r) => {
        setReport(r);
        const qr = await qrCodes.get(r.qrCodeId);
        setTag(qr);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.reportId]);

  async function sendReply() {
    if (!report || !reply.trim()) return;
    setSending(true);
    try {
      await reports.respond(report.id, reply.trim());
      setReply('');
      alert('Reply sent');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="border-b border-surface-border bg-surface-card px-4 py-4">
        <Link href="/dashboard/reports" className="text-sm text-[#7a6957] hover:text-brand-400">
          ← Alerts
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">Alert detail</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        {loading && <p className="text-sm text-[#9d8c7a]">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {report && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
              <p className="text-xs uppercase tracking-wide text-[#7a6957]">Tag</p>
              <p className="text-lg font-semibold text-white">{tag?.name ?? tag?.label ?? report.qrCodeId}</p>
              <p className="mt-3 text-sm text-[#5a4a3d]">{report.finderNotes || 'No notes provided'}</p>
              <p className="mt-2 text-xs text-[#9d8c7a]">Contact: {report.finderContact}</p>
              {report.locationAddress && (
                <p className="mt-1 text-xs text-[#9d8c7a]">Location: {report.locationAddress}</p>
              )}
            </div>

            <div className="rounded-2xl border border-surface-border bg-surface-card p-4 space-y-3">
              <label className="text-xs font-medium text-[#7a6957]">Reply to finder</label>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white"
                placeholder="Thank them or ask for more details…"
              />
              <button
                type="button"
                disabled={sending || !reply.trim()}
                onClick={sendReply}
                className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send reply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
