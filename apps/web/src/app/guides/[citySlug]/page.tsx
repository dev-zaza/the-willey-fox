import { notFound } from 'next/navigation';
import PrintButton from './print-button';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1')
  .replace(/\/api\/v\d+\/?$/, '') + '/api/v1';

interface TravelGuide {
  slug: string;
  city: string;
  region: string | null;
  lastUpdated: string | null;
  videoCount: number;
  highlights: Array<{
    title: string;
    channel: string;
    url: string;
    thumbnail?: string;
    viewCount?: number;
  }>;
  safetyTips: string[];
  topPlaces: Array<{ place: string; mentionCount: number }>;
  recommendations: string[];
}

async function fetchGuide(slug: string): Promise<TravelGuide | null> {
  try {
    const res = await fetch(`${API_BASE}/safety-engine/travel-guide/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<TravelGuide>;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const guide = await fetchGuide(citySlug);
  if (!guide) return { title: 'Travel Guide — SafeTag' };
  return {
    title: `${guide.city} Travel Safety Guide — SafeTag`,
    description: `Safety tips, top places, and local highlights for ${guide.city}${guide.region ? `, ${guide.region}` : ''}.`,
  };
}

export default async function TravelGuidePage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const guide = await fetchGuide(citySlug);

  if (!guide) notFound();

  return (
    <div className="min-h-screen bg-[#F2F4E5] print:bg-white">
      {/* Print bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between print:hidden">
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FF7B14] flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="font-bold text-gray-900">SafeTag</span>
        </a>
        <PrintButton />
      </div>

      <main className="max-w-3xl mx-auto px-6 py-10 gap-10 flex flex-col">
        {/* Header */}
        <div className="text-center gap-3 flex flex-col">
          <div className="inline-flex items-center gap-2 bg-[#FF7B14]/10 text-[#FF7B14] text-xs font-bold px-3 py-1.5 rounded-full mx-auto">
            SafeTag Travel Guide
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900">
            {guide.city}
          </h1>
          {guide.region && (
            <p className="text-lg text-gray-500">{guide.region}</p>
          )}
          {guide.lastUpdated && (
            <p className="text-sm text-gray-400">Last updated: {new Date(guide.lastUpdated).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
          )}
        </div>

        {/* Safety Tips */}
        {guide.safetyTips.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-500 text-sm">⚠</span>
              Safety Notes
            </h2>
            <div className="bg-white rounded-2xl border border-red-100 p-5 gap-3 flex flex-col">
              {guide.safetyTips.map((tip, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-red-400 text-sm mt-0.5 flex-shrink-0">•</span>
                  <p className="text-sm text-gray-700 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Places */}
        {guide.topPlaces.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-500 text-sm">📍</span>
              Top Mentioned Places
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {guide.topPlaces.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-medium text-gray-800">{p.place}</span>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                    {p.mentionCount} mention{p.mentionCount !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {guide.recommendations.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center text-green-600 text-sm">✓</span>
              Recommendations
            </h2>
            <div className="bg-white rounded-2xl border border-green-100 p-5 gap-3 flex flex-col">
              {guide.recommendations.map((r, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-green-500 text-sm mt-0.5 flex-shrink-0">→</span>
                  <p className="text-sm text-gray-700 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Video Highlights */}
        {guide.highlights.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 text-sm">▶</span>
              Video Highlights
            </h2>
            <div className="grid gap-4">
              {guide.highlights.map((h, i) => (
                <a
                  key={i}
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4 items-start hover:border-[#FF7B14]/40 transition-colors print:no-underline"
                >
                  {h.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.thumbnail} alt="" className="w-24 h-16 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 gap-1 flex flex-col">
                    <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{h.title}</p>
                    <p className="text-xs text-gray-400">{h.channel}</p>
                    {h.viewCount && (
                      <p className="text-xs text-gray-300">{h.viewCount.toLocaleString()} views</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-4 print:mt-8">
          Generated by SafeTag · safetag.app · Data sourced from public safety datasets and community knowledge.
        </div>
      </main>
    </div>
  );
}
