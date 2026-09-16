'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { families } from '@/lib/api';
import { ONBOARD_FAMILY_ID_KEY, ONBOARD_FAMILY_NAME_KEY } from '@/lib/family-profiles';

export default function OnboardGroupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function continueFlow() {
    const familyName = name.trim() || 'My Family';
    setLoading(true);
    setError('');
    try {
      // Create immediately so the group exists before adding members
      const existingId =
        typeof window !== 'undefined' ? sessionStorage.getItem(ONBOARD_FAMILY_ID_KEY) : null;
      if (existingId) {
        sessionStorage.setItem(ONBOARD_FAMILY_NAME_KEY, familyName);
        router.push('/onboard/members');
        return;
      }
      const family = await families.create(familyName);
      sessionStorage.setItem(ONBOARD_FAMILY_ID_KEY, family.id);
      sessionStorage.setItem(ONBOARD_FAMILY_NAME_KEY, family.name);
      router.push('/onboard/members');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create family group');
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6" style={{ background: '#f0e7d6', color: '#1b1410' }}>
      <Link href="/onboard/welcome" className="mb-8 text-sm" style={{ color: '#7a6957' }}>← Back</Link>
      <h1 className="text-2xl font-bold">Name your group</h1>
      <p className="mt-2 text-sm" style={{ color: '#5a4a3d' }}>Family, team, or household — you can change this later.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Smith Family"
        className="mt-6 w-full rounded-xl border px-4 py-3 text-sm"
        style={{ borderColor: 'rgba(27,20,16,0.15)', background: '#fffdf8' }}
        disabled={loading}
      />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => void continueFlow()}
        disabled={loading}
        className="mt-6 rounded-2xl py-3 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: '#ea2e00' }}
      >
        {loading ? 'Creating…' : 'Continue'}
      </button>
    </div>
  );
}
