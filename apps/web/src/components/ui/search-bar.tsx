'use client';

import { useState, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import type { LatLng } from '@/types';

interface SearchResult {
  label: string;
  location: LatLng;
}

interface SearchBarProps {
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
}

export function SearchBar({ onSelect, placeholder = 'Search destination…' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
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
    setQuery(r.label.split(',')[0]);
    setResults([]);
    onSelect(r);
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full glass rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 border border-transparent transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 glass rounded-xl overflow-hidden z-50 shadow-xl">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-surface-elevated hover:text-white transition-colors border-b border-surface-border last:border-0 truncate"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute top-full left-0 right-0 mt-1 glass rounded-xl px-4 py-3 text-xs text-slate-400">
          Searching…
        </div>
      )}
    </div>
  );
}
