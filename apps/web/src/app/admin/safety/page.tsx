'use client';

import { useEffect, useState } from 'react';
import { admin, type AdminIngestionLog, type AdminSafetyZone } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable, StatusBadge } from '@/components/admin/data-table';
import { cn } from '@/lib/utils';

export default function SafetyPage() {
  const [logs, setLogs] = useState<AdminIngestionLog[]>([]);
  const [zones, setZones] = useState<AdminSafetyZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([admin.listIngestionLogs(), admin.listSafetyZones()])
      .then(([l, z]) => { setLogs(l); setZones(z); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      <AdminPageHeader title="Safety" description="Ingestion logs and safety zone data" />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider admin-text-subtle">Ingestion Logs</h2>
        <DataTable
          loading={loading}
          data={logs}
          getKey={(l) => l.id}
          emptyMessage="No ingestion logs"
          columns={[
            {
              key: 'source',
              header: 'Source',
              render: (l) => <span className="text-sm admin-text-color capitalize">{l.source}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (l) => <StatusBadge status={l.status} />,
            },
            {
              key: 'records',
              header: 'Records',
              render: (l) => <span className="text-sm admin-text-muted tabular-nums">{l.recordsIngested ?? '—'}</span>,
            },
            {
              key: 'error',
              header: 'Error',
              className: 'max-w-48',
              render: (l) => l.errorMessage
                ? <span className="text-xs text-red-400 truncate block">{l.errorMessage}</span>
                : <span className="admin-text-subtle">—</span>,
            },
            {
              key: 'created',
              header: 'Date',
              render: (l) => <span className="text-xs admin-text-subtle">{new Date(l.createdAt).toLocaleDateString()}</span>,
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider admin-text-subtle">Safety Zones</h2>
        <DataTable
          loading={loading}
          data={zones}
          getKey={(z) => z.id}
          emptyMessage="No safety zones"
          columns={[
            {
              key: 'source',
              header: 'Source',
              render: (z) => <span className="text-sm admin-text-color capitalize">{z.source}</span>,
            },
            {
              key: 'region',
              header: 'Region',
              render: (z) => <span className="text-sm admin-text-muted">{z.sourceRegion ?? '—'}</span>,
            },
            {
              key: 'score',
              header: 'Safety Score',
              render: (z) => {
                const score = Number(z.safetyScore);
                return (
                  <span className={cn(
                    'text-sm font-bold tabular-nums',
                    score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400',
                  )}>
                    {z.safetyScore}
                  </span>
                );
              },
            },
            {
              key: 'period',
              header: 'Period Start',
              render: (z) => <span className="text-xs admin-text-subtle">{z.periodStart ? new Date(z.periodStart).toLocaleDateString() : '—'}</span>,
            },
            {
              key: 'updated',
              header: 'Updated',
              render: (z) => <span className="text-xs admin-text-subtle">{new Date(z.updatedAt).toLocaleDateString()}</span>,
            },
          ]}
        />
      </section>
    </div>
  );
}
