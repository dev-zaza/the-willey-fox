import Link from 'next/link';
import type { Metadata } from 'next';
import type { BroadcastListItem } from '@/lib/api';

export const revalidate = 60;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

export const metadata: Metadata = {
  title: 'Missing person alerts — TheWileyfox',
  description: 'Community-verified missing person alerts. Share widely to help reunite families.',
  openGraph: {
    title: 'Missing person alerts — TheWileyfox',
    description: 'Help find missing loved ones. Browse active broadcasts published by family guardians.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

async function getBroadcasts(): Promise<BroadcastListItem[]> {
  try {
    const res = await fetch(`${API_URL}/public/broadcasts?page=1&pageSize=20`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as BroadcastListItem[];
  } catch {
    return [];
  }
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export default async function BroadcastsPage() {
  const items = await getBroadcasts();

  return (
    <div className="min-h-screen bg-surface text-white">
      <header className="border-b border-surface-border bg-surface-card">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold">Missing person alerts</h1>
          <p className="text-[#7a6957] mt-2 text-sm">
            Active broadcasts published by family guardians. If you have information, please contact the family directly
            or your local emergency services.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {items.length === 0 ? (
          <div className="text-center py-20 text-[#9d8c7a]">
            <p className="font-medium text-white text-lg">No active alerts</p>
            <p className="text-sm mt-2">There are no active missing person broadcasts at this time.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {items.map((b) => (
              <Link
                key={b.id}
                href={`/broadcasts/${b.id}`}
                className="bg-surface-card border border-red-500/30 rounded-2xl overflow-hidden hover:border-red-500/60 transition-colors"
              >
                <div className="aspect-square bg-surface overflow-hidden">
                  {b.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.photoUrl}
                      alt={`${b.name ?? 'Missing person'} — last seen ${b.lastSeenLocation ?? ''}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#7a6957]">
                      No photo available
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-red-400 text-xs font-bold uppercase tracking-wide">MISSING</p>
                    <p className="text-[#9d8c7a] text-xs">{daysUntil(b.broadcastExpiresAt)}d left</p>
                  </div>
                  <h2 className="text-white font-semibold">{b.name ?? 'Missing person'}</h2>
                  {b.lastSeenLocation && (
                    <p className="text-[#7a6957] text-sm">Last seen: {b.lastSeenLocation}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
