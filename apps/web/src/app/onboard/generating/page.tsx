'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ONBOARD_FAMILY_NAME_KEY } from '@/lib/family-profiles';

export default function OnboardGeneratingPage() {
  const router = useRouter();
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    setGroupName(sessionStorage.getItem(ONBOARD_FAMILY_NAME_KEY) || '');
    const t = setTimeout(() => router.replace('/onboard/done'), 2200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 px-6 text-center" style={{ background: '#f0e7d6', color: '#1b1410' }}>
      <div className="h-20 w-20 animate-spin rounded-full border-4 border-[#ea2e00]/25 border-t-[#ea2e00]" />
      <div>
        <h1 className="text-xl font-extrabold">Creating QR safety profiles…</h1>
        <p className="mt-2 max-w-sm text-sm leading-6" style={{ color: '#5a4a3d' }}>
          Setting up{groupName ? ` ${groupName}` : ' your group'} and generating unique QR codes for each member.
        </p>
      </div>
    </div>
  );
}
