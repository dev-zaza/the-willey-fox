import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { BroadcastDetail } from '@/lib/api';
import BroadcastMessageForm from './BroadcastMessageForm';

export const revalidate = 60;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

async function getBroadcast(id: string): Promise<{ status: number; data: BroadcastDetail | null }> {
  try {
    const res = await fetch(`${API_URL}/public/broadcasts/${id}`, {
      next: { revalidate: 60 },
    });
    if (res.status === 410 || res.status === 404) {
      return { status: res.status, data: null };
    }
    if (!res.ok) return { status: res.status, data: null };
    return { status: 200, data: (await res.json()) as BroadcastDetail };
  } catch {
    return { status: 500, data: null };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { data } = await getBroadcast(id);
  if (!data) {
    return { title: 'Alert no longer active — TheWileyfox', robots: { index: false, follow: false } };
  }
  const title = `Missing: ${data.name ?? 'person'} — help find them`;
  const desc = data.lastSeenLocation
    ? `Last seen at ${data.lastSeenLocation}. If you have information, please share this alert.`
    : 'If you have information, please share this alert.';
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: data.photoUrl ? [{ url: data.photoUrl }] : [],
      type: 'article',
    },
    robots: { index: true, follow: true },
  };
}

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, data } = await getBroadcast(id);

  if (status === 404) {
    notFound();
  }

  if (status === 410 || !data) {
    return (
      <div className="min-h-screen bg-surface text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold">This alert is no longer active</h1>
          <p className="text-[#7a6957]">
            The broadcast has expired or been resolved. Thank you for your interest in helping.
          </p>
          <a href="/broadcasts" className="inline-block mt-4 text-brand-400 hover:underline">
            Browse active alerts
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-white">
      <header className="border-b border-surface-border bg-surface-card">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <a href="/broadcasts" className="text-brand-400 text-sm hover:underline">
            ← All alerts
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/2">
            <div className="aspect-square bg-surface-card rounded-2xl overflow-hidden border border-red-500/30">
              {data.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.photoUrl}
                  alt={`Photo of ${data.name ?? 'missing person'}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#7a6957]">
                  No photo available
                </div>
              )}
            </div>
          </div>

          <div className="md:w-1/2 space-y-4">
            <div>
              <p className="text-red-400 text-sm font-bold uppercase tracking-widest">MISSING PERSON ALERT</p>
              <h1 className="text-3xl font-bold mt-1">{data.name ?? 'Missing person'}</h1>
            </div>

            {data.description && <p className="text-[#5a4a3d]">{data.description}</p>}

            {data.lastSeenLocation && (
              <div>
                <p className="text-[#9d8c7a] text-xs uppercase tracking-wide">Last seen</p>
                <p className="text-white">{data.lastSeenLocation}</p>
              </div>
            )}

            {data.lastSeenNotes && (
              <div>
                <p className="text-[#9d8c7a] text-xs uppercase tracking-wide">Notes</p>
                <p className="text-[#5a4a3d] text-sm">{data.lastSeenNotes}</p>
              </div>
            )}

            {data.customFields && typeof data.customFields === 'object' && Object.keys(data.customFields).length > 0 && (
              <MedicalBlock fields={data.customFields as Record<string, unknown>} />
            )}
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-3">
          <h2 className="text-white font-semibold">Have information?</h2>
          <p className="text-[#7a6957] text-sm">
            If you believe you have seen this person, contact the family through TheWileyfox directly. For emergencies,
            contact local emergency services immediately.
          </p>
          <BroadcastMessageForm broadcastId={data.id} />
        </div>

        <div className="text-xs text-[#7a6957] text-center">
          Alert expires {new Date(data.broadcastExpiresAt).toLocaleDateString()}
        </div>
      </main>
    </div>
  );
}

function MedicalBlock({ fields }: { fields: Record<string, unknown> }) {
  const medical = fields.medicalInfo as Record<string, unknown> | undefined;
  if (!medical || typeof medical !== 'object') return null;
  const entries = Object.entries(medical).filter(([, v]) => !!v);
  if (entries.length === 0) return null;
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
      <p className="text-red-300 text-xs font-bold uppercase tracking-wide mb-2">Medical</p>
      <dl className="text-xs space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-[#9d8c7a] capitalize">{k.replace(/([A-Z])/g, ' $1')}:</dt>
            <dd className="text-slate-200">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
