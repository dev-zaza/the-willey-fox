'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Download,
  ExternalLink,
  Lightbulb,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Ticket,
  X,
} from 'lucide-react';
import { directions, safetyEngine, type AreaSummary } from '@/lib/api';
import { GLOBAL_CITIES, UK_CITIES } from '@/lib/mockup-cities';
import { SaveSpotForm } from '@/components/dashboard/save-spot-form';

const BAND_META: Record<string, { label: string; color: string; bg: string; num: number }> = {
  band5: { label: 'Safe', color: '#3FA34D', bg: '#F0FDF4', num: 5 },
  band4: { label: 'Low Risk', color: '#A4C957', bg: '#F7FBE8', num: 4 },
  band3: { label: 'Stay Aware', color: '#FFC857', bg: '#FFFBEB', num: 3 },
  band2: { label: 'Elevated', color: '#F46036', bg: '#FFF1ED', num: 2 },
  band1: { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', num: 1 },
  low_count: { label: 'Low Data', color: '#9ED2B2', bg: '#F0FDF9', num: 0 },
  green: { label: 'Safe', color: '#3FA34D', bg: '#F0FDF4', num: 5 },
  amber: { label: 'Stay Aware', color: '#FFC857', bg: '#FFFBEB', num: 3 },
  red: { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', num: 1 },
  purple: { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', num: 1 },
};

const BAND_STRIP = ['#D7263D', '#F46036', '#FFC857', '#A4C957', '#3FA34D'];
const DOT_COLORS = ['#D7263D', '#F46036', '#FFC857', '#A4C957', '#3FA34D', '#2196F3', '#9C27B0', '#795548'];
const GYG_PARTNER_ID = 'WXZGXR9';

const TRAVEL_TIPS: Record<string, string[]> = {
  london: [
    'Avoid leaving valuables visible in parked cars in Zone 1.',
    'The Tube is generally safe; stay aware of pickpockets at busy stations.',
    'Stick to well-lit routes around Westminster and Southwark after dark.',
    'Night buses are a safe alternative when the Tube closes.',
  ],
  manchester: [
    'Northern Quarter is lively at night — stay in groups.',
    'Avoid Piccadilly Gardens late at night.',
    'The Metrolink is well-monitored and safe after dark.',
  ],
  birmingham: [
    'The Bullring and Brindleyplace areas are well-policed.',
    'Use licensed black cabs or apps like Uber when travelling after midnight.',
  ],
  edinburgh: [
    'The Royal Mile is tourist-heavy — watch for pickpockets.',
    'Meadows area is safe for daytime walking.',
    'Avoid Leith Walk late on weekends.',
  ],
};

const DEFAULT_TIPS = [
  'Keep bags zipped and in front of you in crowded areas.',
  'Note the nearest A&E — NHS 111 is available 24/7.',
  'Share your location with a trusted contact when exploring new areas.',
  'Stick to well-lit, populated streets after dark.',
];

function getTips(cityName: string): string[] {
  const key = cityName.toLowerCase().trim();
  return TRAVEL_TIPS[key] ?? DEFAULT_TIPS;
}

function formatCrimeType(raw: string): string {
  return raw.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function citySlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/_/g, '-');
}

interface GeocodeResult {
  id: string;
  name: string;
  fullName: string;
  lat: number;
  lng: number;
}

export interface AreaSafetyPanelProps {
  seedLat?: string | number | null;
  seedLng?: string | number | null;
  seedName?: string;
  variant?: 'page' | 'panel';
  onClose?: () => void;
  onFlyTo?: (lat: number, lng: number, name: string) => void;
}

export function AreaSafetyPanel({
  seedLat,
  seedLng,
  seedName = '',
  variant = 'page',
  onClose,
  onFlyTo,
}: AreaSafetyPanelProps) {
  const router = useRouter();
  const isPanel = variant === 'panel';
  const placeLabel = seedName.trim();

  const [query, setQuery] = useState(placeLabel);
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [summary, setSummary] = useState<AreaSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState<GeocodeResult | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCheckLoading, setRouteCheckLoading] = useState(false);
  const [guideAvailable, setGuideAvailable] = useState<boolean | null>(null);
  const [guideHtml, setGuideHtml] = useState<string | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [error, setError] = useState('');

  const userTypingRef = useRef(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seededRef = useRef(false);

  const loadSummary = useCallback(async (lat: number, lng: number, city = '') => {
    setSummaryLoading(true);
    setError('');
    try {
      const data = await safetyEngine.getAreaSummary({ lat, lng, radius: 5000, city });
      setSummary(data);
    } catch (e: unknown) {
      setSummary(null);
      setError(e instanceof Error ? e.message : 'Failed to load area summary');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadGuide = useCallback(async (city: string) => {
    if (!city.trim()) {
      setGuideAvailable(false);
      setGuideHtml(null);
      return;
    }
    setGuideLoading(true);
    setGuideAvailable(null);
    setGuideHtml(null);
    try {
      const result = await safetyEngine.renderTravelGuide(city);
      setGuideAvailable(result.available);
      setGuideHtml(result.html);
    } catch {
      setGuideAvailable(false);
      setGuideHtml(null);
    } finally {
      setGuideLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(loc);
        if (!seedLat && !seedLng && !seededRef.current) {
          seededRef.current = true;
          void loadSummary(loc.lat, loc.lng);
        }
      },
      () => {
        if (!seedLat && !seedLng) setError('Location permission denied — search for a city instead.');
      },
    );
  }, [loadSummary, seedLat, seedLng]);

  useEffect(() => {
    if (seedLat == null || seedLng == null || seedLat === '' || seedLng === '' || seededRef.current) return;
    seededRef.current = true;
    const lat = Number(seedLat);
    const lng = Number(seedLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const displayName = placeLabel || 'This area';
    const area: GeocodeResult = {
      id: 'seed',
      name: displayName,
      fullName: displayName,
      lat,
      lng,
    };
    setSelectedArea(area);
    setQuery(displayName);
    void loadSummary(lat, lng, placeLabel);
    if (placeLabel) void loadGuide(placeLabel);
  }, [seedLat, seedLng, placeLabel, loadSummary, loadGuide]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim() || query.length < 2 || !userTypingRef.current) {
      if (!userTypingRef.current) setSuggestions([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await directions.geocode(query.trim(), currentLocation ?? undefined);
        setSuggestions(Array.isArray(results) ? results.slice(0, 5) : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query, currentLocation]);

  async function selectArea(area: GeocodeResult) {
    userTypingRef.current = false;
    setSelectedArea(area);
    setSuggestions([]);
    setQuery(area.name);
    onFlyTo?.(area.lat, area.lng, area.name);
    await loadSummary(area.lat, area.lng, area.name);
    void loadGuide(area.name);
  }

  async function openRouteWithSafetyCheck() {
    if (!selectedArea) return;
    const dest = { lat: selectedArea.lat, lng: selectedArea.lng };
    const mapsUrl = currentLocation
      ? `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${dest.lat},${dest.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;

    if (!currentLocation) {
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setRouteCheckLoading(true);
    try {
      const result = await directions.routeSafetyCheck(currentLocation, dest);
      if (result.flaggedSegments?.length > 0) {
        const bands = [...new Set(result.flaggedSegments.map((s) => s.band))];
        const high = bands.some((b) => b === 'band1' || b === 'purple');
        const ok = window.confirm(
          `${high ? 'High Caution' : 'Elevated'} area on route — passes through ${result.flaggedSegments.length} flagged zone(s). Open maps anyway?`,
        );
        if (!ok) return;
      }
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setRouteCheckLoading(false);
    }
  }

  function downloadTravelGuide() {
    if (!guideHtml) return;
    const city = summary?.cityName || selectedArea?.name || 'area';
    const blob = new Blob([guideHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wiley-fox-${citySlug(city)}-travel-guide.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleBack() {
    if (isPanel) {
      onClose?.();
      return;
    }
    router.push('/dashboard');
  }

  const band = summary?.band ? (BAND_META[summary.band] ?? BAND_META.band3) : null;
  const score = summary?.score != null ? Math.round(summary.score) : null;
  const displayCity = summary?.cityName || selectedArea?.name || placeLabel;
  const tips = getTips(displayCity);
  const guideCity = displayCity;
  const guideHref = guideCity ? `/guides/${citySlug(guideCity)}` : null;

  return (
    <div
      className={
        isPanel
          ? 'flex h-full min-h-0 flex-1 flex-col bg-surface-card text-[#232323]'
          : 'min-h-screen bg-[#F2F4E5] pb-10 text-[#232323]'
      }
    >
      <header
        className={
          isPanel
            ? 'flex-shrink-0 border-b border-[#ECECEC] bg-white px-4 pb-3 pt-3'
            : 'sticky top-0 z-20 border-b border-[#ECECEC] bg-white/95 px-4 pb-4 pt-safe backdrop-blur'
        }
      >
        <div className={`flex items-center gap-3 ${isPanel ? '' : 'mx-auto max-w-2xl pt-4'}`}>
          <button
            type="button"
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F4E5]"
            aria-label={isPanel ? 'Close' : 'Back'}
          >
            {isPanel ? <X className="h-4 w-4 text-[#FF7B14]" /> : <ArrowLeft className="h-4 w-4 text-[#FF7B14]" />}
          </button>
          <h1 className="flex-1 text-lg font-bold">Area Safety</h1>
          {guideAvailable && (
            <button
              type="button"
              onClick={downloadTravelGuide}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFE9D6] text-[#FF7B14]"
              title="Download travel guide"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className={`relative mt-3 ${isPanel ? '' : 'mx-auto max-w-2xl'}`}>
          <div className="flex items-center gap-2 rounded-2xl border border-[#ECECEC] bg-[#F2F4E5] px-3 py-2.5">
            <Search className="h-4 w-4 flex-shrink-0 text-[#8a8a8a]" />
            <input
              value={query}
              onChange={(e) => {
                userTypingRef.current = true;
                setQuery(e.target.value);
              }}
              placeholder="Search city or area…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#8a8a8a]"
            />
            {searchLoading && <Loader2 className="h-4 w-4 animate-spin text-[#FF7B14]" />}
            {query && !searchLoading && (
              <button
                type="button"
                onClick={() => {
                  userTypingRef.current = false;
                  setQuery('');
                  setSuggestions([]);
                }}
                aria-label="Clear search"
              >
                <X className="h-4 w-4 text-[#8a8a8a]" />
              </button>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[#ECECEC] bg-white shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void selectArea(s)}
                  className="flex w-full items-start gap-2 border-b border-[#ECECEC] px-4 py-3 text-left last:border-0 hover:bg-[#F2F4E5]"
                >
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF7B14]" />
                  <span>
                    <span className="block text-sm font-semibold">{s.name}</span>
                    <span className="block text-xs text-[#8a8a8a]">{s.fullName}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main
        className={
          isPanel
            ? 'min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4'
            : 'mx-auto max-w-2xl space-y-4 px-4 pt-5'
        }
      >
        <section>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#8A7B67]">UK cities · live data</p>
          <div className="grid grid-cols-2 gap-2">
            {UK_CITIES.map((city) => (
              <button
                key={city.name}
                type="button"
                onClick={() =>
                  void selectArea({
                    id: city.name,
                    name: city.name,
                    fullName: city.name,
                    lat: city.lat,
                    lng: city.lng,
                  })
                }
                className={`rounded-[10px] border px-3 py-2.5 text-left text-[13px] font-medium ${
                  displayCity.toLowerCase() === city.name.toLowerCase()
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-[#E3D8C6] bg-[#FBF7F1] text-[#17130F] hover:border-brand-500 hover:bg-white'
                }`}
              >
                {city.name}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wider text-[#8A7B67]">Global cities · safety index</p>
          <div className="grid grid-cols-2 gap-2">
            {GLOBAL_CITIES.map((city) => (
              <button
                key={city.name}
                type="button"
                onClick={() =>
                  void selectArea({
                    id: city.name,
                    name: city.name,
                    fullName: city.name,
                    lat: city.lat,
                    lng: city.lng,
                  })
                }
                className={`rounded-[10px] border px-3 py-2.5 text-left text-[13px] font-medium ${
                  displayCity.toLowerCase() === city.name.toLowerCase()
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-[#E3D8C6] bg-[#FBF7F1] text-[#17130F] hover:border-brand-500 hover:bg-white'
                }`}
              >
                {city.name}
              </button>
            ))}
          </div>
        </section>

        <SaveSpotForm fallbackLat={selectedArea?.lat ?? currentLocation?.lat} fallbackLng={selectedArea?.lng ?? currentLocation?.lng} />

        {summaryLoading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF7B14]" />
            <p className="text-sm text-[#8a8a8a]">Loading safety data…</p>
          </div>
        )}

        {error && !summaryLoading && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {!summaryLoading && summary && (
          <>
            <section className="rounded-2xl border border-[#ECECEC] bg-white p-5">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-[3px] text-2xl font-black"
                  style={{ borderColor: band?.color ?? '#888', background: band?.bg ?? '#F2F4E5', color: band?.color ?? '#888' }}
                >
                  {score != null ? score : '?'}
                </div>
                <div>
                  <h2 className="text-xl font-black">{band?.label ?? 'No Data'}</h2>
                  <p className="mt-0.5 text-sm text-[#8a8a8a]">
                    {displayCity || selectedArea?.fullName || 'Current Area'}
                  </p>
                  {band && band.num > 0 && (
                    <p className="mt-1 text-xs font-bold" style={{ color: band.color }}>
                      Band {band.num} of 5
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex h-2.5 gap-1 overflow-hidden rounded-md">
                  {BAND_STRIP.map((c, i) => (
                    <div
                      key={c}
                      className="flex-1"
                      style={{ backgroundColor: c, opacity: band && band.num > 0 && i + 1 === band.num ? 1 : 0.22 }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-[#8a8a8a]">
                  <span>High Caution</span>
                  <span>Safe</span>
                </div>
              </div>

              <p className="mt-3 text-[11px] leading-4 text-[#8a8a8a]">{summary.scoreMethodology}</p>
              <p className="mt-1 text-[11px] text-[#8a8a8a]">
                Data period: {summary.dataMonth} · Radius: {(summary.radiusMetres / 1000).toFixed(1)} km
              </p>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#ECECEC] bg-white p-4 text-center">
                <div className="text-2xl font-black">{summary.incidentCount.toLocaleString()}</div>
                <div className="mt-1 text-[11px] text-[#8a8a8a]">Crimes recorded</div>
              </div>
              <div className="rounded-2xl border border-[#ECECEC] bg-white p-4 text-center">
                <div className="text-2xl font-black">{summary.weightedPerKm2.toLocaleString()}</div>
                <div className="mt-1 text-[11px] text-[#8a8a8a]">Weighted / km²</div>
              </div>
            </div>

            {summary.crimeBreakdown.length > 0 && (
              <section className="rounded-2xl border border-[#ECECEC] bg-white p-5">
                <h3 className="mb-4 text-sm font-bold">Crime Breakdown</h3>
                <div className="space-y-3">
                  {summary.crimeBreakdown.slice(0, 8).map((item, i) => {
                    const topTotal = summary.crimeBreakdown.slice(0, 8).reduce((s, x) => s + x.count, 0);
                    const pct = topTotal > 0 ? (item.count / topTotal) * 100 : 0;
                    return (
                      <div key={item.type}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }}
                            />
                            <span className="truncate text-sm">{formatCrimeType(item.type)}</span>
                          </div>
                          <span className="text-sm font-bold text-[#8a8a8a]">{item.count.toLocaleString()}</span>
                        </div>
                        <div className="h-1 rounded bg-[#ECECEC]">
                          <div
                            className="h-1 rounded"
                            style={{ width: `${Math.round(pct)}%`, backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {selectedArea && (
              <button
                type="button"
                onClick={() => void openRouteWithSafetyCheck()}
                disabled={routeCheckLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ECECEC] bg-white py-3.5 text-sm font-semibold disabled:opacity-60"
              >
                {routeCheckLoading ? <Loader2 className="h-4 w-4 animate-spin text-[#FF7B14]" /> : <Navigation className="h-4 w-4 text-[#FF7B14]" />}
                Open Route in Maps
              </button>
            )}

            <section className="rounded-2xl border border-[#ECECEC] bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[#FF7B14]" />
                <h3 className="text-sm font-bold">Wiley Fox Travel Intelligence</h3>
              </div>
              <ul className="space-y-3">
                {tips.map((tip, i) => (
                  <li key={tip} className="flex gap-3 text-sm leading-5">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#FFE9D6] text-[11px] font-extrabold text-[#FF7B14]">
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </section>

            {guideCity && (
              <section className="space-y-3 rounded-2xl border border-[#ECECEC] bg-white p-5">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-violet-600" />
                  <h3 className="text-sm font-bold">Things To Do</h3>
                </div>
                <a
                  href={`https://www.getyourguide.com/s/?q=${encodeURIComponent(guideCity)}&partner_id=${GYG_PARTNER_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700"
                >
                  GetYourGuide — {guideCity}
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(guideCity)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700"
                >
                  Find stays on Booking.com
                  <ExternalLink className="h-4 w-4" />
                </a>
              </section>
            )}

            <section className="space-y-3 pb-2">
              {guideLoading && (
                <p className="text-center text-xs text-[#8a8a8a]">Checking travel guide…</p>
              )}
              {guideAvailable && (
                <button
                  type="button"
                  onClick={downloadTravelGuide}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#232323] py-3.5 text-sm font-semibold text-white"
                >
                  <Download className="h-4 w-4" />
                  Download travel guide
                </button>
              )}
              {guideHref && (
                <Link
                  href={guideHref}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FF7B14] bg-[#FFE9D6] py-3.5 text-sm font-semibold text-[#E2620A]"
                >
                  <BarChart3 className="h-4 w-4" />
                  Open full travel guide
                </Link>
              )}
              {guideCity && (
                <Link
                  href={`/dashboard/area/${encodeURIComponent(citySlug(guideCity))}?lat=${summary.lat}&lng=${summary.lng}&name=${encodeURIComponent(guideCity)}`}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ECECEC] bg-white py-3.5 text-sm font-semibold"
                >
                  See detailed safety report
                </Link>
              )}
            </section>
          </>
        )}

        {!summaryLoading && !summary && !error && (
          <p className="py-12 text-center text-sm text-[#8a8a8a]">
            Search for a city or allow location to see area safety.
          </p>
        )}
      </main>
    </div>
  );
}
