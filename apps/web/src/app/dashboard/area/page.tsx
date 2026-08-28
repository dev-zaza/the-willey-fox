'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { safetyEngine, type AreaSummary } from '@/lib/api';

export default function AreaPage() {
  const [summary, setSummary] = useState<AreaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Location unavailable');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await safetyEngine.getAreaSummary({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            radius: 5000,
          });
          setSummary(data);
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Failed to load area summary');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError('Location permission denied');
        setLoading(false);
      },
    );
  }, []);

  const citySlug = summary?.cityName
    ? summary.cityName.toLowerCase().replace(/\s+/g, '-')
    : null;

  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="border-b border-surface-border bg-surface-card px-4 py-4">
        <Link href="/dashboard" className="text-sm text-[#7a6957] hover:text-brand-400">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">Area safety</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        {loading && <p className="text-sm text-[#9d8c7a]">Loading area summary…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {summary && (
          <div className="space-y-4 rounded-2xl border border-surface-border bg-surface-card p-5">
            <div>
              <p className="text-xs uppercase text-[#7a6957]">Area</p>
              <p className="text-lg font-semibold text-white">{summary.cityName || 'Current location'}</p>
            </div>
            {summary.score != null && (
              <div>
                <p className="text-xs uppercase text-[#7a6957]">Safety score</p>
                <p className="text-3xl font-bold text-brand-400">{summary.score}</p>
                {summary.band && <p className="text-sm text-[#9d8c7a]">{summary.band}</p>}
              </div>
            )}
            <p className="text-sm leading-6 text-[#5a4a3d]">
              {summary.incidentCount} incidents within {summary.radiusMetres}m
              {summary.dataMonth ? ` · data ${summary.dataMonth}` : ''}
            </p>
            {summary.scoreMethodology && (
              <p className="text-xs leading-5 text-[#9d8c7a]">{summary.scoreMethodology}</p>
            )}
            {summary.crimeBreakdown?.length > 0 && (
              <ul className="space-y-1">
                {summary.crimeBreakdown.slice(0, 6).map((row) => (
                  <li key={row.type} className="flex justify-between text-sm text-[#5a4a3d]">
                    <span>{row.type}</span>
                    <span className="text-[#9d8c7a]">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
            {citySlug && (
              <Link href={`/guides/${citySlug}`} className="text-sm text-brand-400 hover:text-brand-300">
                View travel guide →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
