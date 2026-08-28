'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function OnboardWelcomePage() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center" style={{ background: '#f0e7d6', color: '#1b1410' }}>
      <h1 className="text-3xl font-bold">Welcome to TheWileyfox</h1>
      <p className="mt-4 max-w-md text-sm leading-6" style={{ color: '#5a4a3d' }}>
        Set up your family group and register your first QR tag in a few steps.
      </p>
      <button
        type="button"
        onClick={() => router.push('/onboard/group')}
        className="mt-8 rounded-2xl px-8 py-3 text-sm font-semibold text-white"
        style={{ background: '#ea2e00' }}
      >
        Get started
      </button>
      <Link href="/dashboard" className="mt-4 text-sm" style={{ color: '#7a6957' }}>
        Skip for now
      </Link>
    </div>
  );
}
