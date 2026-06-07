'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { admin, safetyOverlay, type AdminIngestionLog, type AdminSafetyZone, type SafetyZoneOverlay } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable, StatusBadge } from '@/components/admin/data-table';
import { MapView } from '@/components/map/map-view';
import { cn } from '@/lib/utils';

type Source = 'uk_police' | 'fbi' | 'eurostat' | 'us_travel_advisory' | 'all';

const SOURCES: { value: Source; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'uk_police', label: 'UK Police' },
  { value: 'us_travel_advisory', label: 'Travel Advisory' },
  { value: 'eurostat', label: 'Eurostat' },
  { value: 'fbi', label: 'FBI' },
];

type BoundsPayload = { minLat: number; minLng: number; maxLat: number; maxLng: number };

export default function SafetyPage() {
  const [logs, setLogs] = useState<AdminIngestionLog[]>([]);
  const [zones, setZones] = useState<AdminSafetyZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<Source | null>(null);
  const [triggerMsg, setTriggerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [overlayZones, setOverlayZones] = useState<SafetyZoneOverlay[]>([]);
  const boundsRef = useRef<BoundsPayload | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(() => {
    return Promise.all([admin.listIngestionLogs(), admin.listSafetyZones()])
      .then(([l, z]) => { setLogs(l); setZones(z); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBoundsChange = useCallback((bounds: BoundsPayload) => {
    boundsRef.current = bounds;
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => {
      safetyOverlay.get(bounds)
        .then(res => setOverlayZones(res.zones))
        .catch(() => {});
    }, 400);
  }, []);

  async function handleTrigger(source: Source) {
    setTriggering(source);
    setTriggerMsg(null);
    try {
      const res = await admin.triggerIngestion(source);
      setTriggerMsg({ type: 'success', text: `Queued: ${res.queued.join(', ')}. Check logs in ~1 min.` });
      setTimeout(() => loadData(), 5000);
    } catch {
      setTriggerMsg({ type: 'error', text: 'Failed to queue ingestion job.' });
    } finally {
      setTriggering(null);
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      <AdminPageHeader title="Safety" description="Ingestion logs and safety zone data" />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider admin-text-subtle">Trigger Ingestion</h2>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleTrigger(value)}
              disabled={triggering !== null}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                value === 'all'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {triggering === value ? 'Queuing…' : label}
            </button>
          ))}
        </div>
        {triggerMsg && (
          <p className={cn(
            'text-xs',
            triggerMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400',
          )}>
            {triggerMsg.text}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider admin-text-subtle">Safety Zone Map</h2>
          <span className="text-xs admin-text-subtle">{overlayZones.length} zones in view</span>
        </div>
        <div className="rounded-lg overflow-hidden border border-neutral-700" style={{ height: 480 }}>
          <MapView
            safetyZones={overlayZones}
            onBoundsChange={handleBoundsChange}
          />
        </div>
        <div className="flex gap-4 text-xs admin-text-subtle">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-600 opacity-70" /> Safe ≥70</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-amber-500 opacity-70" /> Caution ≥40</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-500 opacity-70" /> Danger &lt;40</span>
        </div>
      </section>

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
              header: 'Zones',
              render: (l) => (
                <span className="text-sm admin-text-muted tabular-nums">
                  {l.zonesCreated + l.zonesUpdated > 0
                    ? `+${l.zonesCreated} / ~${l.zonesUpdated}`
                    : '—'}
                </span>
              ),
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
