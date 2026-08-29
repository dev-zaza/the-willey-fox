'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { markOnboardingDone } from '@/lib/onboarding';

export default function OnboardDonePage() {
  useEffect(() => {
    markOnboardingDone();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center" style={{ background: '#f0e7d6', color: '#1b1410' }}>
      <div className="mb-4 text-4xl">✓</div>
      <h1 className="text-2xl font-bold">You&apos;re all set</h1>
      <p className="mt-3 max-w-sm text-sm leading-6" style={{ color: '#5a4a3d' }}>
        Your family group and first tag are ready. Open the dashboard to manage tags, alerts, and safety tools.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-block rounded-2xl px-8 py-3 text-sm font-semibold text-white"
        style={{ background: '#ea2e00' }}
      >
        Go to dashboard
      </Link>
    </div>
  );
}
