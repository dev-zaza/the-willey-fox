'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { directions, spots, type Spot } from '@/lib/api';

export function SaveSpotForm({
  fallbackLat,
  fallbackLng,
  onCreated,
}: {
  fallbackLat?: number;
  fallbackLng?: number;
  onCreated?: (spot: Spot) => void;
}) {
  const [url, setUrl] = useState('');
  const [place, setPlace] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const locationName = place.trim() || 'Saved spot';
    setSaving(true);
    setError('');
    setStatus('Looking up location…');
    try {
      let lat = fallbackLat;
      let lng = fallbackLng;
      const results = await directions.geocode(place.trim() || locationName);
      const first = Array.isArray(results) ? results[0] : undefined;
      if (first) {
        lat = first.lat;
        lng = first.lng;
      }
      if (lat == null || lng == null) {
        throw new Error('Add a place name we can find on the map.');
      }
      const notes = url.trim() ? `instagram:${url.trim()}` : undefined;
      const created = await spots.create({ name: locationName, lat, lng, notes });
      setUrl('');
      setPlace('');
      setStatus('');
      onCreated?.(created);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save this spot');
      setStatus('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E3D8C6] bg-[#FBF7F1] p-4">
      <div className="mb-3">
        <p className="text-sm font-bold text-[#17130F]">Save a Spot</p>
        <p className="mt-0.5 text-[11px] text-[#8A7B67]">Pin a place to the map — paste an Instagram URL if you have one</p>
      </div>
      <div className="flex flex-col gap-2">
        <input
          className="w-full rounded-[9px] border border-[#E3D8C6] bg-white px-3 py-2 text-xs text-[#17130F] outline-none placeholder:text-[#8A7B67] focus:border-brand-500"
          placeholder="Paste Instagram post URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input
          className="w-full rounded-[9px] border border-[#E3D8C6] bg-white px-3 py-2 text-xs text-[#17130F] outline-none placeholder:text-[#8A7B67] focus:border-brand-500"
          placeholder="Location / place name (e.g. Soho, London)"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        />
        <button
          type="button"
          disabled={saving || !place.trim()}
          onClick={() => void handleSave()}
          className="flex items-center justify-center gap-1.5 rounded-[9px] bg-[#17130F] py-2.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-brand-500"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Pin to Map
        </button>
        {status ? <p className="text-[11px] text-[#8A7B67]">{status}</p> : null}
        {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
