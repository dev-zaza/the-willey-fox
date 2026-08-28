'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { families, qrCodes } from '@/lib/api';

export default function OnboardMembersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function finishSetup() {
    setLoading(true);
    setError('');
    try {
      const familyName = sessionStorage.getItem('onboard_family_name') || 'My Family';
      const family = await families.create(familyName);
      const tag = await qrCodes.create({ name: 'My first tag', label: 'My first tag', category: 'other' });
      await families.addQrCode(family.id, tag.id);
      sessionStorage.removeItem('onboard_family_name');
      router.push('/onboard/generating');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Setup failed');
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6" style={{ background: '#f0e7d6', color: '#1b1410' }}>
      <Link href="/onboard/group" className="mb-8 text-sm" style={{ color: '#7a6957' }}>← Back</Link>
      <h1 className="text-2xl font-bold">Create your first tag</h1>
      <p className="mt-2 text-sm leading-6" style={{ color: '#5a4a3d' }}>
        We&apos;ll create your family group and register a starter QR tag. You can customize it anytime from My Tags.
      </p>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={finishSetup}
        disabled={loading}
        className="mt-8 rounded-2xl py-3 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: '#ea2e00' }}
      >
        {loading ? 'Setting up…' : 'Finish setup'}
      </button>
    </div>
  );
}
