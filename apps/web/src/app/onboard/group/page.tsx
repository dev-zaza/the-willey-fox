'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ONBOARD_FAMILY_NAME_KEY } from '@/lib/family-profiles';

export default function OnboardGroupPage() {
  const router = useRouter();
  const [name, setName] = useState('');

  function continueFlow() {
    sessionStorage.setItem(ONBOARD_FAMILY_NAME_KEY, name.trim() || 'My Family');
    router.push('/onboard/members');
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
      />
      <button type="button" onClick={continueFlow} className="mt-6 rounded-2xl py-3 text-sm font-semibold text-white" style={{ background: '#ea2e00' }}>
        Continue
      </button>
    </div>
  );
}
