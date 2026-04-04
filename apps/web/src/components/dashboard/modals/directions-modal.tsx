'use client';

import { useState, useCallback, useRef } from 'react';
import { Navigation, Loader2, AlertCircle, Search, X, ChevronRight } from 'lucide-react';
import { directions, type RouteOption, ApiError } from '@/lib/api';
import type { LatLng } from '@/types';

interface DirectionsModalProps {
  onRouteSelect: (route: LatLng[]) => void;
}

interface GeoResult {
  label: string;
  location: LatLng;
}

function gradeColor(grade: string): string {
  switch (grade?.toUpperCase()) {
    case 'A': return '#16a34a';
    case 'B': return '#65a30d';
    case 'C': return '#f59e0b';
    case 'D': return '#ea580c';
    default: return '#ef4444';
  }
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatDuration(s: number) {
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function LocationInput({
  placeholder,
  onSelect,
}: {
  placeholder: string;
  onSelect: (r: GeoResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=4`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const data = await res.json();
      setResults(
        data.map((item: any) => ({
          label: item.display_name,
          location: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
        })),
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 350);
  }

  function handleSelect(r: GeoResult) {
    setQuery(r.label.split(',')[0]);
    setResults([]);
    onSelect(r);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full bg-surface border border-surface-border rounded-xl pl-9 pr-8 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {(results.length > 0 || searching) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-card border border-surface-border rounded-xl overflow-hidden z-50 shadow-xl">
          {searching && <p className="px-4 py-3 text-xs text-slate-400">Searching…</p>}
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-surface-elevated hover:text-white transition-colors border-b border-surface-border last:border-0 truncate"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DirectionsModal({ onRouteSelect }: DirectionsModalProps) {
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [locating, setLocating] = useState(false);

  async function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginLabel('My location');
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  async function getRoute() {
    if (!origin || !destination) {
      setError('Please set both origin and destination.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await directions.getRoute(
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      );
      setRoutes(res.routes ?? []);
      if ((res.routes ?? []).length === 0) setError('No routes found.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to get routes.');
    } finally {
      setLoading(false);
    }
  }

  function handleShowOnMap(route: RouteOption) {
    const latlngs = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    onRouteSelect(latlngs);
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Navigation className="w-5 h-5 text-brand-400" />
        <h2 className="text-white font-semibold">Get Directions</h2>
      </div>

      {/* Origin */}
      <div className="space-y-1.5">
        <p className="text-xs text-slate-400 font-medium">Origin</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <LocationInput
              placeholder={originLabel || 'Search origin…'}
              onSelect={(r) => { setOrigin(r.location); setOriginLabel(r.label.split(',')[0]); }}
            />
          </div>
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-brand-500/15 border border-brand-500/30 rounded-xl text-brand-400 text-xs font-medium hover:bg-brand-500/25 disabled:opacity-40 transition-colors"
          >
            {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '📍'}
            Me
          </button>
        </div>
        {originLabel && (
          <p className="text-xs text-slate-500 px-1 truncate">{originLabel}</p>
        )}
      </div>

      {/* Destination */}
      <div className="space-y-1.5">
        <p className="text-xs text-slate-400 font-medium">Destination</p>
        <LocationInput
          placeholder="Search destination…"
          onSelect={(r) => setDestination(r.location)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={getRoute}
        disabled={loading || !origin || !destination}
        className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white font-medium text-sm py-2.5 rounded-xl transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
        {loading ? 'Finding route…' : 'Get Route'}
      </button>

      {/* Route results */}
      {routes.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{routes.length} route{routes.length !== 1 ? 's' : ''} found</p>
          {routes.map((route, i) => (
            <div key={i} className="bg-surface-card border border-surface-border rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-white font-semibold text-sm">{route.label}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: gradeColor(route.safetyGrade) + '22',
                        color: gradeColor(route.safetyGrade),
                        borderWidth: 1,
                        borderColor: gradeColor(route.safetyGrade) + '55',
                      }}
                    >
                      Grade {route.safetyGrade}
                    </span>
                    <span className="text-xs text-slate-400">Score: {route.safetyScore}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white text-sm font-medium">{formatDistance(route.distance)}</p>
                  <p className="text-slate-400 text-xs">{formatDuration(route.duration)}</p>
                </div>
              </div>

              {route.warnings.length > 0 && (
                <div className="space-y-1">
                  {route.warnings.map((w, wi) => (
                    <div key={wi} className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                      <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => handleShowOnMap(route)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-brand-500/15 text-brand-400 text-xs font-medium hover:bg-brand-500/25 transition-colors"
              >
                Show on Map <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
