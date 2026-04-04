'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { admin, type AdminQrRow } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable, StatusBadge } from '@/components/admin/data-table';

export default function QrCodesPage() {
  const [rows, setRows] = useState<AdminQrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    admin.listQrCodes(limit, offset).then(setRows).catch(console.error).finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <AdminPageHeader title="QR Codes" description="All registered QR tags on the platform" />
      <DataTable
        loading={loading}
        data={rows}
        getKey={(r) => r.id}
        offset={offset}
        limit={limit}
        onPrev={() => setOffset((o) => Math.max(0, o - limit))}
        onNext={() => setOffset((o) => o + limit)}
        emptyMessage="No QR codes found"
        columns={[
          {
            key: 'code',
            header: 'Code',
            render: (r) => <span className="font-mono text-xs admin-accent-text">{r.uniqueCode}</span>,
          },
          {
            key: 'name',
            header: 'Name',
            render: (r) => <span className="text-sm admin-text-color">{r.name}</span>,
          },
          {
            key: 'category',
            header: 'Category',
            render: (r) => <StatusBadge status={r.category} />,
          },
          {
            key: 'lost',
            header: 'Lost',
            render: (r) => r.isLost
              ? <span className="text-xs font-medium text-red-400">Lost</span>
              : <span className="admin-text-subtle">—</span>,
          },
          {
            key: 'active',
            header: 'Active',
            render: (r) => r.isActive
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              : <span className="admin-text-subtle">—</span>,
          },
          {
            key: 'created',
            header: 'Created',
            render: (r) => <span className="text-xs admin-text-subtle">{new Date(r.createdAt).toLocaleDateString()}</span>,
          },
        ]}
      />
    </div>
  );
}
