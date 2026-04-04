'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { admin, type AdminUserReport } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable, StatusBadge } from '@/components/admin/data-table';

export default function UserReportsPage() {
  const [rows, setRows] = useState<AdminUserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    admin.listUserReports(limit, offset).then(setRows).catch(console.error).finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  async function dismiss(id: string) {
    setActionLoading(id);
    try {
      await admin.dismissUserReport(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {}
    finally { setActionLoading(null); }
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <AdminPageHeader title="User Reports" description="Reports submitted by users about other users" />
      <DataTable
        loading={loading}
        data={rows}
        getKey={(r) => r.id}
        offset={offset}
        limit={limit}
        onPrev={() => setOffset((o) => Math.max(0, o - limit))}
        onNext={() => setOffset((o) => o + limit)}
        emptyMessage="No user reports"
        columns={[
          {
            key: 'date',
            header: 'Date',
            render: (r) => <span className="text-xs admin-text-subtle">{new Date(r.createdAt).toLocaleDateString()}</span>,
          },
          {
            key: 'reporter',
            header: 'Reporter',
            className: 'max-w-28',
            render: (r) => <span className="font-mono text-xs admin-text-subtle">{r.reporterId.slice(0, 8)}…</span>,
          },
          {
            key: 'reported',
            header: 'Reported User',
            className: 'max-w-28',
            render: (r) => <span className="font-mono text-xs admin-text-subtle">{r.reportedId.slice(0, 8)}…</span>,
          },
          {
            key: 'reason',
            header: 'Reason',
            className: 'max-w-48',
            render: (r) => <span className="text-xs admin-text-color truncate block">{r.reason}</span>,
          },
          {
            key: 'context',
            header: 'Context',
            render: (r) => <span className="text-xs admin-text-subtle">{r.contextType ?? '—'}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (r) => (
              <button
                onClick={() => dismiss(r.id)}
                disabled={actionLoading === r.id}
                className="inline-flex items-center gap-1.5 rounded-lg border admin-border-color admin-surface-raised px-2.5 py-1 text-xs admin-text-muted admin-hover disabled:opacity-40 transition-colors"
              >
                {actionLoading === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Dismiss
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
