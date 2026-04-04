'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { admin, type AdminPinRow } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable, StatusBadge } from '@/components/admin/data-table';

export default function PinsPage() {
  const [rows, setRows] = useState<AdminPinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    admin.listPins(limit, offset).then(setRows).catch(console.error).finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  async function deletePin(id: string) {
    if (!confirm('Delete this pin? This cannot be undone.')) return;
    setActionLoading(id);
    try {
      await admin.deletePin(id);
      setRows((prev) => prev.filter((p) => p.id !== id));
    } catch {}
    finally { setActionLoading(null); }
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <AdminPageHeader title="Pins" description="Community safety pins on the map" />
      <DataTable
        loading={loading}
        data={rows}
        getKey={(r) => r.id}
        offset={offset}
        limit={limit}
        onPrev={() => setOffset((o) => Math.max(0, o - limit))}
        onNext={() => setOffset((o) => o + limit)}
        emptyMessage="No pins found"
        columns={[
          {
            key: 'type',
            header: 'Type',
            render: (p) => <StatusBadge status={p.type} />,
          },
          {
            key: 'title',
            header: 'Title',
            render: (p) => <span className="text-sm admin-text-color">{p.title}</span>,
          },
          {
            key: 'coords',
            header: 'Coordinates',
            render: (p) => (
              <span className="font-mono text-xs admin-text-subtle">
                {parseFloat(p.lat).toFixed(4)}, {parseFloat(p.lng).toFixed(4)}
              </span>
            ),
          },
          {
            key: 'votes',
            header: 'Votes',
            render: (p) => (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-400">↑{p.upvotes}</span>
                <span className="text-red-400">↓{p.downvotes}</span>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (p) => <StatusBadge status={p.status} />,
          },
          {
            key: 'created',
            header: 'Created',
            render: (p) => <span className="text-xs admin-text-subtle">{new Date(p.createdAt).toLocaleDateString()}</span>,
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (p) => (
              <button
                onClick={() => deletePin(p.id)}
                disabled={actionLoading === p.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
              >
                {actionLoading === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
