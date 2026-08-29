'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AreaSafetyPanel } from '@/components/dashboard/area-safety-panel';
import { useIsDesktop } from '@/hooks/use-is-desktop';

export default function AreaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F2F4E5]">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF7B14]" />
        </div>
      }
    >
      <AreaPageFromQuery />
    </Suspense>
  );
}

function AreaPageFromQuery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();

  const seedLat = searchParams.get('lat');
  const seedLng = searchParams.get('lng');
  const seedName = searchParams.get('name') ?? '';

  useEffect(() => {
    if (!isDesktop) return;
    const qs = new URLSearchParams();
    if (seedLat) qs.set('areaLat', seedLat);
    if (seedLng) qs.set('areaLng', seedLng);
    if (seedName) qs.set('areaName', seedName);
    router.replace(`/dashboard${qs.toString() ? `?${qs}` : ''}`);
  }, [isDesktop, router, seedLat, seedLng, seedName]);

  if (isDesktop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F4E5]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF7B14]" />
      </div>
    );
  }

  return (
    <AreaSafetyPanel
      seedLat={seedLat}
      seedLng={seedLng}
      seedName={seedName}
      variant="page"
    />
  );
}
