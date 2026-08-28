'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { safetyEngine, type AreaSummary } from '@/lib/api';

export default function AreaDetailPage() {
  const params = useParams<{ slug: string }>();
  const [summary, setSummary] = useState<AreaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.slug) return;
    safetyEngine
      .getAreaSummary({ lat: 0, lng: 0, city: params.slug })
      .then(setSummary)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [params.slug]);

  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="border-b border-surface-border bg-surface-card px-4 py-4">
        <Link href="/dashboard/area" className="text-sm text-[#7a6957] hover:text-brand-400">
          ← Area safety
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">{params.slug}</h1>
      </div>
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {loading && <p className="text-sm text-[#9d8c7a]">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {summary && (
          <div className="space-y-3 rounded-2xl border border-surface-border bg-surface-card p-5">
            <p className="text-lg font-semibold text-white">{summary.cityName || params.slug}</p>
            {summary.score != null && (
              <div>
                <p className="text-3xl font-bold text-brand-400">{summary.score}</p>
                {summary.band && <p className="text-sm text-[#9d8c7a]">{summary.band}</p>}
              </div>
            )}
            <p className="text-sm text-[#5a4a3d]">
              {summary.incidentCount} incidents · {summary.radiusMetres}m radius
            </p>
            {summary.scoreMethodology && (
              <p className="text-xs leading-5 text-[#9d8c7a]">{summary.scoreMethodology}</p>
            )}
          </div>
        )}
        <Link href={`/guides/${params.slug}`} className="inline-block text-sm text-brand-400">
          Open full travel guide →
        </Link>
      </div>
    </div>
  );
}
