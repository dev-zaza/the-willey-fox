'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { spots, type Spot } from '@/lib/api';

export default function SpotsPage() {
  const [items, setItems] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const data = await spots.listNearby(latitude, longitude);
          setItems(data);
        } finally {
          setLoading(false);
        }
      },
      () => setLoading(false),
    );
  }, []);

  async function addSpot() {
    if (!coords || !name.trim()) return;
    const created = await spots.create({ name: name.trim(), lat: coords.lat, lng: coords.lng });
    setItems((prev) => [created, ...prev]);
    setName('');
  }

  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="border-b border-surface-border bg-surface-card px-4 py-4">
        <Link href="/dashboard" className="text-sm text-[#7a6957] hover:text-brand-400">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">Saved spots</h1>
      </div>

      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="rounded-2xl border border-surface-border bg-surface-card p-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spot name (e.g. School gate)"
            className="w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={addSpot}
            disabled={!coords}
            className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save current location
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[#9d8c7a]">Loading nearby spots…</p>
        ) : (
          <div className="space-y-2">
            {items.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-card p-4">
                <div>
                  <p className="font-medium text-white">{s.name}</p>
                  <p className="text-xs text-[#9d8c7a]">{Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => spots.delete(s.id).then(() => setItems((prev) => prev.filter((x) => x.id !== s.id)))}
                  className="text-xs text-red-400"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
