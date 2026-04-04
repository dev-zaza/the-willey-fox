'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Users, QrCode, Flag, MapPin, Shield, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { admin, type AdminAnalytics } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { cn } from '@/lib/utils';

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  sublabel,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  colorClass: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl border admin-border-color admin-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium admin-text-subtle uppercase tracking-wider">{label}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold admin-text-color tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sublabel && <p className="text-xs admin-text-subtle mt-1">{sublabel}</p>}
    </div>
  );
}

function MiniChart({ data, color }: { data: { date: string; count: number }[]; color: string }) {
  if (!data.length) return <p className="text-xs admin-text-subtle">No data yet</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.slice(-30).map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${d.count}`}
          style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
          className={cn('flex-1 rounded-sm min-w-[2px]', color)}
        />
      ))}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.getAnalytics().then(setAnalytics).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin admin-text-subtle" />
      </div>
    );
  }

  const totals = analytics?.totals ?? (analytics as any) ?? {};
  const timeSeries = analytics?.timeSeries;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <AdminPageHeader
        title="Overview"
        description="Platform-wide analytics and key metrics"
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Total Users" value={totals.users ?? 0} icon={Users} colorClass="bg-blue-500/15 text-blue-400" sublabel="registered accounts" />
        <StatCard label="QR Codes" value={totals.qrCodes ?? 0} icon={QrCode} colorClass="admin-accent-bg-dim admin-accent-text" sublabel="tags issued" />
        <StatCard label="Reports" value={totals.reports ?? 0} icon={Flag} colorClass="bg-amber-500/15 text-amber-400" sublabel="finder reports" />
        <StatCard label="Pins" value={totals.pins ?? 0} icon={MapPin} colorClass="bg-emerald-500/15 text-emerald-400" sublabel="community pins" />
        <StatCard label="Safety Zones" value={totals.safetyZones ?? 0} icon={Shield} colorClass="bg-violet-500/15 text-violet-400" sublabel="mapped zones" />
      </div>

      {timeSeries && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border admin-border-color admin-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold admin-text-color">New Users</p>
                <p className="text-xs admin-text-subtle mt-0.5">Last 30 days</p>
              </div>
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
            <MiniChart data={timeSeries.newUsersLast30Days} color="bg-blue-500/60" />
            <div className="mt-4 border-t admin-border-color pt-4 max-h-48 overflow-y-auto space-y-1">
              {timeSeries.newUsersLast30Days.slice().reverse().slice(0, 10).map((row) => (
                <div key={row.date} className="flex items-center justify-between text-xs">
                  <span className="admin-text-subtle">{row.date}</span>
                  <span className="admin-text-color font-medium tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border admin-border-color admin-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold admin-text-color">Reports</p>
                <p className="text-xs admin-text-subtle mt-0.5">Last 30 days</p>
              </div>
              <TrendingDown className="h-4 w-4 text-amber-400" />
            </div>
            <MiniChart data={timeSeries.reportsLast30Days} color="bg-amber-500/60" />
            <div className="mt-4 border-t admin-border-color pt-4 max-h-48 overflow-y-auto space-y-1">
              {timeSeries.reportsLast30Days.slice().reverse().slice(0, 10).map((row) => (
                <div key={row.date} className="flex items-center justify-between text-xs">
                  <span className="admin-text-subtle">{row.date}</span>
                  <span className="admin-text-color font-medium tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
