import { GuideGate } from '@/components/guides/guide-gate';

export async function generateMetadata({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const title = citySlug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
  return {
    title: `${title} Travel Guide — Wiley Fox`,
    description: `Pro travel guide for ${title}.`,
    robots: { index: false, follow: false },
  };
}

export default async function TravelGuideEntryPage({
  params,
}: {
  params: Promise<{ citySlug: string }>;
}) {
  const { citySlug } = await params;
  return <GuideGate citySlug={citySlug.toLowerCase()} />;
}
