'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { broadcasts } from '@/lib/api';

export default function BroadcastMessageForm({ broadcastId }: { broadcastId: string }) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setAuthed(!!localStorage.getItem('accessToken'));
  }, []);

  if (!authed) {
    return (
      <div className="text-sm">
        <a href={`/login?redirect=/broadcasts/${broadcastId}`} className="text-brand-400 hover:underline">
          Sign in to contact the family
        </a>
        <p className="text-[#9d8c7a] text-xs mt-1">An account is required to prevent abuse.</p>
      </div>
    );
  }

  async function contact() {
    setBusy(true);
    setError(null);
    try {
      const { conversationId } = await broadcasts.messageGuardian(broadcastId);
      router.push(`/dashboard/messages?conversation=${conversationId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      setError(msg.includes('429') ? 'Too many messages. Please try again later.' : 'Could not start conversation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={contact}
        disabled={busy}
        className="bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {busy ? 'Connecting…' : 'Message the family'}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
