'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { admin, type AdminReportRow } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable, StatusBadge } from '@/components/admin/data-table';

export default function ReportsPage() {
  const [rows, setRows] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    admin.listReports(limit, offset, statusFilter || undefined)
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [offset, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    setActionLoading(id);
    try {
      const updated = await admin.updateReportStatus(id, status);
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: updated.status } : r));
    } catch {}
    finally { setActionLoading(null); }
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <AdminPageHeader title="Reports" description="Finder reports and flagged content" />

      <select
        value={statusFilter}
        onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
        className="h-9 rounded-lg border admin-border-color admin-surface px-3 text-sm admin-text-color focus:outline-none admin-accent-ring"
      >
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="flagged">Flagged</option>
        <option value="contacted">Contacted</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
        <option value="closed">Closed</option>
      </select>

      <DataTable
        loading={loading}
        data={rows}
        getKey={(r) => r.id}
        offset={offset}
        limit={limit}
        onPrev={() => setOffset((o) => Math.max(0, o - limit))}
        onNext={() => setOffset((o) => o + limit)}
        emptyMessage="No reports found"
        columns={[
          {
            key: 'contact',
            header: 'Finder Contact',
            render: (r) => <span className="text-xs admin-text-color">{r.finderContact ?? '—'}</span>,
          },
          {
            key: 'notes',
            header: 'Notes',
            className: 'max-w-48',
            render: (r) => <span className="text-xs admin-text-muted truncate block">{r.finderNotes ?? '—'}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'flag',
            header: 'Flag Reason',
            className: 'max-w-36',
            render: (r) => <span className="text-xs admin-text-subtle truncate block">{r.flagReason ?? '—'}</span>,
          },
          {
            key: 'created',
            header: 'Created',
            render: (r) => <span className="text-xs admin-text-subtle">{new Date(r.createdAt).toLocaleDateString()}</span>,
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (r) => r.status === 'flagged' ? (
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => updateStatus(r.id, 'resolved')}
                  disabled={actionLoading === r.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
                >
                  {actionLoading === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Resolve
                </button>
                <button
                  onClick={() => updateStatus(r.id, 'dismissed')}
                  disabled={actionLoading === r.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-[#7a6957] hover:bg-zinc-700 disabled:opacity-40 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            ) : null,
          },
        ]}
      />
    </div>
  );
}
