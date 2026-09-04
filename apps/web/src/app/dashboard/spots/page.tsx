'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { safetyEngine, spots, type Spot } from '@/lib/api';
import { SaveSpotForm } from '@/components/dashboard/save-spot-form';

const BAND_LABEL: Record<number, string> = {
  1: 'High caution',
  2: 'Caution',
  3: 'Stay aware',
  4: 'Low incident',
  5: 'Very low incident',
};

export default function SpotsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [bands, setBands] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const data = await spots.listNearby(latitude, longitude, 50000);
          setItems(data);
          const next: Record<string, number> = {};
          await Promise.all(
            data.slice(0, 12).map(async (s) => {
              try {
                const summary = await safetyEngine.getAreaSummary({
                  lat: Number(s.lat),
                  lng: Number(s.lng),
                  radius: 2000,
                });
                const n = summary.band?.replace('band', '');
                const num = n ? Number(n) : 0;
                if (num) next[s.id] = num;
              } catch {
                /* ignore */
              }
            }),
          );
          setBands(next);
        } finally {
          setLoading(false);
        }
      },
      () => setLoading(false),
    );
  }, []);

  return (
    <div className="min-h-screen bg-[#F1E7D8] px-4 py-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">SAVED PLACES</p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-[#17130F]">Your saved spots</h1>
            <p className="mt-2 max-w-[66ch] text-sm text-[#5C5245]">
              Every place you pin from the map lands here, with the live safety band for its area. Click a card to fly to it.
            </p>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-[#E3D8C6] bg-white px-3 py-2 text-sm font-bold">
            Save a new spot on the map
          </Link>
        </div>

        <div className="mt-6 max-w-md">
          <SaveSpotForm
            onCreated={(spot) => setItems((prev) => [spot, ...prev])}
          />
        </div>

        {loading ? <p className="mt-8 text-sm text-[#8A7B67]">Loading nearby spots…</p> : null}

        {!loading && items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[#E3D8C6] bg-white px-6 py-12 text-center">
            <p className="font-bold text-[#17130F]">No spots saved yet</p>
            <p className="mt-2 text-sm text-[#5C5245]">
              Open the Map, paste an Instagram post URL into Save a Spot in the safety panel, and it will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {items.map((s) => {
              const rating = bands[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/dashboard?areaLat=${s.lat}&areaLng=${s.lng}&areaName=${encodeURIComponent(s.name)}`,
                    )
                  }
                  className="flex gap-3 rounded-2xl border border-[#E3D8C6] bg-white p-3 text-left hover:border-brand-500"
                >
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-orange-400 to-pink-600">
                    {rating ? (
                      <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black">
                        {rating}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-[#17130F]">{s.name}</p>
                    <p className="mt-0.5 text-xs text-[#8A7B67]">
                      {rating ? `${rating}/5 · ${BAND_LABEL[rating] ?? ''}` : 'Safety data unavailable'}
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-xs font-bold text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        void spots.delete(s.id).then(() => setItems((prev) => prev.filter((x) => x.id !== s.id)));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
