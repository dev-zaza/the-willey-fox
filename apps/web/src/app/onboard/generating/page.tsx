'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardGeneratingPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/onboard/done'), 1800);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center" style={{ background: '#f0e7d6', color: '#1b1410' }}>
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#ea2e00] border-t-transparent" />
      <h1 className="text-xl font-bold">Generating your tag…</h1>
      <p className="mt-2 text-sm" style={{ color: '#5a4a3d' }}>Almost ready.</p>
    </div>
  );
}
