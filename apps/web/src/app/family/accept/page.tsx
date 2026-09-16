'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { families } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

function AcceptContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing invite token.');
      return;
    }

    const authToken = getAccessToken();
    if (!authToken) {
      router.push(`/login?redirect=${encodeURIComponent('/family/accept?token=' + token)}`);
      return;
    }

    (async () => {
      try {
        await families.acceptInvite(token);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        const code = err instanceof Error ? err.message : 'Something went wrong.';
        if (code.includes('INVITE_EXPIRED')) {
          setMessage('This invite has expired. Ask the family owner to send a new one.');
        } else if (code.includes('INVITE_ALREADY_USED')) {
          setMessage('This invite has already been used.');
        } else if (code.includes('INVITE_EMAIL_MISMATCH')) {
          setMessage('Sign in with the email address that received this invite.');
        } else {
          setMessage(code);
        }
      }
    })();
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-2xl border border-[#E3D8C6] bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-[#5C5245]">Accepting family invite…</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-2xl border border-[#E3D8C6] bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-extrabold text-[#17130F]">You&apos;re in the family</h1>
        <p className="mt-2 text-sm text-[#5C5245]">
          You can now help protect QR profiles and respond to alerts for this group.
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/family')}
          className="mt-6 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white"
        >
          Open family
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-24 max-w-md rounded-2xl border border-[#E3D8C6] bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-extrabold text-[#17130F]">Invite problem</h1>
      <p className="mt-2 text-sm text-[#5C5245]">{message}</p>
      <button
        type="button"
        onClick={() => router.push('/dashboard')}
        className="mt-6 rounded-xl border border-[#E3D8C6] px-4 py-2.5 text-sm font-bold text-[#17130F]"
      >
        Go to dashboard
      </button>
    </div>
  );
}

export default function FamilyAcceptPage() {
  return (
    <div className="min-h-screen bg-[#F1E7D8] px-4">
      <Suspense fallback={<p className="pt-24 text-center text-sm text-[#5C5245]">Loading…</p>}>
        <AcceptContent />
      </Suspense>
    </div>
  );
}
