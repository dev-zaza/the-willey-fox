'use client';

import { useState, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import type { LatLng } from '@/types';

interface SearchResult {
  label: string;
  primary: string;
  secondary: string;
  location: LatLng;
}

interface SearchBarProps {
  onSelect: (result: { label: string; location: LatLng }) => void;
  placeholder?: string;
}

function splitDisplayName(displayName: string): { primary: string; secondary: string } {
  const parts = displayName.split(',').map((p) => p.trim()).filter(Boolean);
  const primary = parts[0] || displayName;
  const secondary = parts.slice(1).join(', ');
  return { primary, secondary };
}

export function SearchBar({ onSelect, placeholder = 'Search address or place…' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const data = await res.json();
      setResults(
        data.map((item: { display_name: string; lat: string; lon: string }) => {
          const { primary, secondary } = splitDisplayName(item.display_name);
          return {
            label: item.display_name,
            primary,
            secondary,
            location: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
          };
        }),
      );
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 350);
  }

  function handleSelect(r: SearchResult) {
    setQuery(r.primary);
    setResults([]);
    onSelect({ label: r.label, location: r.location });
  }

  return (
    <div className="relative w-full min-w-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a6957] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full glass rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#17130F] placeholder-[#8A7B67] focus:outline-none focus:border-brand-500 border border-[#E3D8C6] bg-white transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6957] hover:text-[#17130F]"
            type="button"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50 shadow-xl border border-[#E3D8C6] bg-white">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full cursor-pointer text-left px-4 py-2.5 hover:bg-[#FBF7F1] transition-colors border-b border-[#E3D8C6] last:border-0"
            >
              <span className="block text-sm font-semibold text-[#17130F] whitespace-normal break-words">
                {r.primary}
              </span>
              {r.secondary ? (
                <span className="mt-0.5 block text-xs text-[#8A7B67] whitespace-normal break-words">
                  {r.secondary}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-[#E3D8C6] bg-white px-4 py-3 text-xs text-[#7a6957]">
          Searching…
        </div>
      )}
    </div>
  );
}
