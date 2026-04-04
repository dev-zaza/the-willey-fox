'use client';

import { useEffect, useState } from 'react';
import { Bell, MapPin, Mail, Phone, Flag, X, Loader2 } from 'lucide-react';
import { qrCodes, reports, type Report, type QrCode, ApiError } from '@/lib/api';

interface AlertItem {
  report: Report;
  tag: QrCode;
}

function timeAgo(dateStr: string) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ReportsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);
  const [flagModal, setFlagModal] = useState<string | null>(null); // reportId
  const [flagReason, setFlagReason] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const [tags, allReports] = await Promise.all([qrCodes.list(), reports.list()]);
      const tagMap = new Map(tags.map((t) => [t.id, t]));
      const items: AlertItem[] = allReports
        .map((report) => {
          const tag = tagMap.get(report.qrCodeId);
          return tag ? { report, tag } : null;
        })
        .filter((x): x is AlertItem => x !== null)
        .sort((a, b) => b.report.createdAt.localeCompare(a.report.createdAt));
      setAlerts(items);
    }
    load().catch(console.error).finally(() => setLoading(false));
  }, []);

  async function submitFlag(reportId: string) {
    const reason = flagReason.trim();
    if (!reason) return;
    setFlagging(true);
    try {
      await reports.flag(reportId, reason);
      setFlagged((prev) => new Set([...prev, reportId]));
      setFlagModal(null);
      setFlagReason('');
    } catch {}
    finally { setFlagging(false); }
  }

  async function sendReply(reportId: string) {
    const text = replyText[reportId]?.trim();
    if (!text) return;
    setReplying(reportId);
    try {
      const resp = await reports.respond(reportId, text);
      setAlerts((prev) =>
        prev.map((a) =>
          a.report.id === reportId
            ? { ...a, report: { ...a.report, responses: [...a.report.responses, resp] } }
            : a,
        ),
      );
      setReplyText((prev) => ({ ...prev, [reportId]: '' }));
    } catch {}
    finally { setReplying(null); }
  }

  return (
    <>
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Lost Alerts</h1>
          <p className="text-slate-400 text-sm mt-1">{alerts.length} report{alerts.length !== 1 ? 's' : ''}</p>
        </div>

        {loading && <div className="text-center text-slate-400 py-20">Loading…</div>}

        {!loading && alerts.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-white">No Alerts Yet</p>
            <p className="text-sm mt-1">Reports from finders will appear here</p>
          </div>
        )}

        <div className="space-y-4">
          {alerts.map(({ report, tag }) => (
            <div key={report.id} className="bg-surface-card border border-surface-border rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">{tag.label ?? tag.name}</p>
                  <p className="text-slate-500 text-xs capitalize">{tag.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-slate-500 text-xs">{timeAgo(report.createdAt)}</p>
                  {flagged.has(report.id) ? (
                    <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      <Flag className="w-3 h-3" /> Flagged
                    </span>
                  ) : (
                    <button
                      onClick={() => { setFlagModal(report.id); setFlagReason(''); }}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-400 transition-colors"
                      title="Flag this report"
                    >
                      <Flag className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {report.finderNotes && (
                <div className="bg-surface rounded-xl p-3">
                  <p className="text-slate-300 text-sm">{report.finderNotes}</p>
                </div>
              )}

              {report.photoUrl && (
                <a href={report.photoUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={report.photoUrl}
                    alt="Finder photo"
                    className="w-full max-h-48 object-cover rounded-xl border border-surface-border"
                  />
                </a>
              )}

              {/* Finder */}
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500">Finder:</p>
                <p className="text-xs text-brand-400 font-medium flex-1 truncate">{report.finderContact}</p>
                {report.finderContact.includes('@') ? (
                  <a href={`mailto:${report.finderContact}`} className="flex items-center gap-1 bg-brand-500/15 text-brand-400 text-xs font-medium px-2 py-1 rounded-lg hover:bg-brand-500/25 transition-colors">
                    <Mail className="w-3 h-3" /> Email
                  </a>
                ) : (
                  <a href={`tel:${report.finderContact}`} className="flex items-center gap-1 bg-green-500/15 text-green-400 text-xs font-medium px-2 py-1 rounded-lg hover:bg-green-500/25 transition-colors">
                    <Phone className="w-3 h-3" /> Call
                  </a>
                )}
              </div>

              {/* Location */}
              {report.locationLat && report.locationLng && (
                <a
                  href={`https://maps.google.com/?q=${report.locationLat},${report.locationLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 hover:border-blue-500/40 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-blue-400 text-xs font-medium">
                    {parseFloat(report.locationLat).toFixed(4)}, {parseFloat(report.locationLng).toFixed(4)}
                  </p>
                </a>
              )}
              {report.locationAddress && !report.locationLat && (
                <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-blue-400 text-xs font-medium">{report.locationAddress}</p>
                </div>
              )}

              {/* Responses */}
              {(report.responses ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Your replies</p>
                  {(report.responses ?? []).map((r) => (
                    <div key={r.id} className="bg-brand-500/10 border border-brand-500/20 rounded-xl px-3 py-2">
                      <p className="text-brand-300 text-xs">{r.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply form */}
              <div className="flex gap-2">
                <input
                  value={replyText[report.id] ?? ''}
                  onChange={(e) => setReplyText((prev) => ({ ...prev, [report.id]: e.target.value }))}
                  placeholder="Reply to finder…"
                  className="flex-1 bg-surface border border-surface-border text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
                  onKeyDown={(e) => e.key === 'Enter' && sendReply(report.id)}
                />
                <button
                  onClick={() => sendReply(report.id)}
                  disabled={replying === report.id || !replyText[report.id]?.trim()}
                  className="bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors"
                >
                  {replying === report.id ? '…' : 'Send'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Flag modal */}
    {flagModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-400" />
              <p className="text-white font-semibold">Flag Report</p>
            </div>
            <button onClick={() => setFlagModal(null)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-400 text-sm">Describe why this report should be reviewed by an admin.</p>
          <textarea
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Reason for flagging…"
            maxLength={500}
            rows={3}
            className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500 resize-none"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setFlagModal(null)}
              className="flex-1 py-2.5 rounded-xl border border-surface-border text-slate-400 text-sm hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => submitFlag(flagModal)}
              disabled={flagging || !flagReason.trim()}
              className="flex-1 py-2.5 rounded-xl bg-amber-500/80 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {flagging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
              {flagging ? 'Flagging…' : 'Flag Report'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
