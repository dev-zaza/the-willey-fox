'use client';

import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { safetyEngine, type AreaSummary } from '@/lib/api';

const BAND_META: Record<string, { label: string; color: string; bg: string; tag: string }> = {
  band5: { label: 'Safe', color: '#3FA34D', bg: '#F0FDF4', tag: 'Below average crime · Generally safe' },
  band4: { label: 'Low Risk', color: '#A4C957', bg: '#F7FBE8', tag: 'Slightly elevated — stay aware' },
  band3: { label: 'Stay Aware', color: '#FFC857', bg: '#FFFBEB', tag: 'Around average · Extra vigilance after dark' },
  band2: { label: 'Elevated', color: '#F46036', bg: '#FFF1ED', tag: 'Above average · Stay aware after dark' },
  band1: { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', tag: 'High crime area · Avoid alone after dark' },
  low_count: { label: 'Low Data', color: '#9ED2B2', bg: '#F0FDF9', tag: 'Limited crime data for this area' },
  green: { label: 'Safe', color: '#3FA34D', bg: '#F0FDF4', tag: 'Below average crime · Generally safe' },
  amber: { label: 'Stay Aware', color: '#FFC857', bg: '#FFFBEB', tag: 'Around average · Extra vigilance after dark' },
  red: { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', tag: 'High crime area · Avoid alone after dark' },
  purple: { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', tag: 'High crime area · Avoid alone after dark' },
};

const DOT_COLORS = ['#D7263D', '#F46036', '#FFC857', '#A4C957', '#3FA34D', '#2196F3'];

function formatCrimeType(raw: string): string {
  return raw.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function citySlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/_/g, '-');
}

export default function AreaDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F2F4E5]">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF7B14]" />
        </div>
      }
    >
      <AreaDetailContent />
    </Suspense>
  );
}

function AreaDetailContent() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const lat = Number(searchParams.get('lat') ?? '0');
  const lng = Number(searchParams.get('lng') ?? '0');
  const name = searchParams.get('name') ?? params.slug ?? '';

  const [summary, setSummary] = useState<AreaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guideHtml, setGuideHtml] = useState<string | null>(null);
  const [guideAvailable, setGuideAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await safetyEngine.getAreaSummary({
          lat: Number.isFinite(lat) ? lat : 0,
          lng: Number.isFinite(lng) ? lng : 0,
          radius: 5000,
          city: name || params.slug,
        });
        if (cancelled) return;
        setSummary(data);
        const city = data.cityName || name;
        if (city) {
          try {
            const guide = await safetyEngine.renderTravelGuide(city);
            if (!cancelled) {
              setGuideAvailable(guide.available);
              setGuideHtml(guide.html);
            }
          } catch {
            /* ignore */
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lng, name, params.slug]);

  function downloadGuide() {
    if (!guideHtml) return;
    const city = summary?.cityName || name || 'area';
    const blob = new Blob([guideHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wiley-fox-${citySlug(city)}-travel-guide.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const band = summary?.band ? (BAND_META[summary.band] ?? BAND_META.band3) : null;
  const score = summary?.score != null ? Math.round(summary.score) : null;
  const city = summary?.cityName || name || params.slug;
  const top = summary?.crimeBreakdown?.slice(0, 6) ?? [];
  const topTotal = top.reduce((s, x) => s + x.count, 0);

  return (
    <div className="min-h-screen bg-[#F2F4E5] pb-10 text-[#232323]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#ECECEC] bg-white/95 px-4 py-4 pt-safe backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F4E5]"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4 text-[#FF7B14]" />
        </button>
        <h1 className="text-lg font-bold">Safety Report</h1>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF7B14]" />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && summary && (
          <>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8a]">
                {city.toUpperCase()}
              </p>
              <h2 className="mt-1 text-3xl font-bold">{city}</h2>
              <p className="mt-1 text-sm text-[#8a8a8a]">
                Last {summary.dataMonth} of crime data · {(summary.radiusMetres / 1000).toFixed(1)} km radius
              </p>
            </div>

            <section className="rounded-2xl border border-[#ECECEC] bg-white p-5">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow"
                  style={{ background: band?.color ?? '#888' }}
                >
                  {score ?? '–'}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8a]">
                    Wiley Fox Safety Rating
                  </p>
                  <p className="text-lg font-bold">{band?.label ?? summary.band ?? 'Unknown'}</p>
                  <p className="text-xs text-[#8a8a8a]">{band?.tag}</p>
                </div>
              </div>
              <div className="relative mt-4 h-2 rounded-full bg-gradient-to-r from-[#D7263D] via-[#FFC857] to-[#3FA34D]">
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-white bg-[#232323] shadow"
                  style={{ left: `calc(${Math.min(95, Math.max(5, score ?? 50))}% - 7px)` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-[#8a8a8a]">
                <span>Highest crime</span>
                <span>Safest</span>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#ECECEC] bg-white p-4 text-center">
                <div className="text-xl font-black">{summary.incidentCount.toLocaleString()}</div>
                <div className="text-[11px] text-[#8a8a8a]">Crimes / period</div>
              </div>
              <div className="rounded-2xl border border-[#ECECEC] bg-white p-4 text-center">
                <div className="text-xl font-black">{summary.weightedPerKm2}</div>
                <div className="text-[11px] text-[#8a8a8a]">Weighted / km²</div>
              </div>
              {top.slice(0, 2).map((item, i) => (
                <div key={item.type} className="rounded-2xl border border-[#ECECEC] bg-white p-4 text-center">
                  <div className="text-xl font-black" style={{ color: DOT_COLORS[i] }}>
                    {topTotal > 0 ? Math.round((item.count / topTotal) * 100) : 0}%
                  </div>
                  <div className="text-[11px] text-[#8a8a8a]">{formatCrimeType(item.type)}</div>
                </div>
              ))}
            </div>

            {top.length > 0 && (
              <section className="rounded-2xl border border-[#ECECEC] bg-white p-5">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#8a8a8a]">
                  Crime breakdown
                </p>
                <div className="space-y-3">
                  {top.map((item, i) => (
                    <div key={item.type} className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                      <span className="flex-1 text-sm">{formatCrimeType(item.type)}</span>
                      <span className="text-sm font-bold text-[#8a8a8a]">{item.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {guideAvailable && (
              <button
                type="button"
                onClick={downloadGuide}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#232323] py-3.5 text-sm font-semibold text-white"
              >
                <Download className="h-4 w-4" />
                Download travel guide
              </button>
            )}

            <Link
              href={`/guides/${citySlug(city)}`}
              className="flex w-full items-center justify-center rounded-2xl border border-[#FF7B14] bg-[#FFE9D6] py-3.5 text-sm font-semibold text-[#E2620A]"
            >
              Open full travel guide
            </Link>

            <Link
              href={`/dashboard/area?lat=${summary.lat}&lng=${summary.lng}&name=${encodeURIComponent(city)}`}
              className="flex w-full items-center justify-center rounded-2xl border border-[#ECECEC] bg-white py-3.5 text-sm font-semibold"
            >
              Back to area safety
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
