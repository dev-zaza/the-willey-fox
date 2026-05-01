'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldOff, FileText } from 'lucide-react';
import { broadcasts as broadcastsApi, type BroadcastAdminItem, type BroadcastConsentLogEntry } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';

export default function AdminBroadcastsPage() {
  const [rows, setRows] = useState<BroadcastAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<BroadcastConsentLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    broadcastsApi.adminList().then(setRows).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function takedown(id: string) {
    const reason = prompt('Reason for takedown (audit log)?') ?? '';
    if (!reason.trim()) return;
    setBusy(id);
    try {
      await broadcastsApi.adminTakedown(id, reason.trim());
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert('Takedown failed.');
      console.error(err);
    } finally {
      setBusy(null);
    }
  }

  async function openLog(id: string) {
    setLogOpen(id);
    setLogLoading(true);
    try {
      const entries = await broadcastsApi.adminConsentLog(id);
      setLogEntries(entries);
    } catch {
      setLogEntries([]);
    } finally {
      setLogLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title="Broadcasts"
        description="Active public missing-person alerts. Take down improper content immediately."
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[#7a6957]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-[#9d8c7a]">No active broadcasts.</div>
      ) : (
        <div className="overflow-x-auto border border-surface-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-surface-card text-[#7a6957] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">QR Code</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Approved</th>
                <th className="text-left px-3 py-2">Expires</th>
                <th className="text-left px-3 py-2">Ext.</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-surface-border">
                  <td className="px-3 py-2 font-mono text-xs text-[#5a4a3d]">{r.qrUniqueCode}</td>
                  <td className="px-3 py-2 text-white">{r.qrLabel ?? r.qrName ?? '—'}</td>
                  <td className="px-3 py-2 text-[#7a6957] capitalize">{r.qrCategory}</td>
                  <td className="px-3 py-2 text-[#7a6957] text-xs">{new Date(r.approvedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-[#7a6957] text-xs">{new Date(r.expiresAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-[#7a6957]">{r.extendCount}/2</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => openLog(r.id)}
                      className="inline-flex items-center gap-1 text-xs text-[#5a4a3d] hover:text-white"
                    >
                      <FileText className="w-3.5 h-3.5" /> Log
                    </button>
                    <button
                      onClick={() => takedown(r.id)}
                      disabled={busy === r.id}
                      className="inline-flex items-center gap-1 text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 px-2 py-1 rounded disabled:opacity-40"
                    >
                      {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      Takedown
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setLogOpen(null)}>
          <div
            className="bg-surface-card border border-surface-border rounded-xl p-4 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Consent log</h3>
              <button onClick={() => setLogOpen(null)} className="text-[#7a6957] hover:text-white">
                ✕
              </button>
            </div>
            {logLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-[#7a6957]" />
              </div>
            ) : logEntries.length === 0 ? (
              <p className="text-[#9d8c7a] text-sm">No log entries.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-[#9d8c7a]">
                  <tr>
                    <th className="text-left py-1">When</th>
                    <th className="text-left py-1">Action</th>
                    <th className="text-left py-1">Guardian</th>
                    <th className="text-left py-1">IP</th>
                    <th className="text-left py-1">ToS</th>
                  </tr>
                </thead>
                <tbody>
                  {logEntries.map((e) => (
                    <tr key={e.id} className="border-t border-surface-border">
                      <td className="py-1 text-[#7a6957]">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="py-1 text-slate-200">{e.action}</td>
                      <td className="py-1 font-mono text-[#9d8c7a]">{e.guardianUserId?.slice(0, 8) ?? '—'}</td>
                      <td className="py-1 font-mono text-[#9d8c7a]">{e.ipAddress ?? '—'}</td>
                      <td className="py-1 text-[#9d8c7a]">{e.tosVersion ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
