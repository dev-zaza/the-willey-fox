'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setTokens } from '@/lib/auth';
import { auth, ApiError } from '@/lib/api';
import { useAuth } from '@/context/auth-context';

export function OAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const [message, setMessage] = useState('Completing sign-in…');

  const code = searchParams.get('code');
  const accessToken = searchParams.get('accessToken');
  const refreshToken = searchParams.get('refreshToken');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let at: string | null = null;
      let rt: string | null = null;

      try {
        if (code) {
          const tokens = await auth.oauthExchange(code);
          if (cancelled) return;
          at = tokens.accessToken;
          rt = tokens.refreshToken;
        } else if (accessToken && refreshToken) {
          at = accessToken;
          rt = refreshToken;
        } else {
          router.replace('/login?error=oauth_failed');
          return;
        }

        setTokens(at, rt);

        const profile = await auth.me();
        if (cancelled) return;
        setUser(profile);
        router.replace(profile.isAdmin ? '/admin' : '/dashboard');
      } catch (e) {
        if (cancelled) return;
        setMessage('');
        if (e instanceof ApiError && e.code === 'OAUTH_CODE_EXPIRED') {
          router.replace('/login?error=oauth_code_expired');
          return;
        }
        router.replace('/login?error=oauth_api_unreachable');
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [code, accessToken, refreshToken, router, setUser]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center space-y-3 max-w-sm px-4">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        {message ? (
          <p className="text-slate-400 text-sm">{message}</p>
        ) : (
          <p className="text-slate-500 text-sm">Redirecting…</p>
        )}
      </div>
    </div>
  );
}
