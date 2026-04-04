'use client';

import { useCallback, useEffect, useState } from 'react';
import { admin, type AdminAuditLog } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable } from '@/components/admin/data-table';

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    admin.listAuditLogs(limit, offset).then(setRows).catch(console.error).finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <AdminPageHeader title="Audit Logs" description="Admin action history and trail" />
      <DataTable
        loading={loading}
        data={rows}
        getKey={(r) => r.id}
        offset={offset}
        limit={limit}
        onPrev={() => setOffset((o) => Math.max(0, o - limit))}
        onNext={() => setOffset((o) => o + limit)}
        emptyMessage="No audit logs yet"
        columns={[
          {
            key: 'timestamp',
            header: 'Timestamp',
            render: (r) => <span className="text-xs admin-text-subtle whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</span>,
          },
          {
            key: 'action',
            header: 'Action',
            render: (r) => <span className="font-mono text-xs admin-accent-text">{r.action}</span>,
          },
          {
            key: 'target_type',
            header: 'Target Type',
            render: (r) => <span className="text-xs admin-text-subtle">{r.targetType ?? '—'}</span>,
          },
          {
            key: 'target_id',
            header: 'Target ID',
            className: 'max-w-32',
            render: (r) => <span className="font-mono text-xs admin-text-subtle truncate block">{r.targetId ?? '—'}</span>,
          },
          {
            key: 'metadata',
            header: 'Details',
            className: 'max-w-48',
            render: (r) => (
              <span className="text-xs admin-text-subtle truncate block">
                {r.metadata ? JSON.stringify(r.metadata) : '—'}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
