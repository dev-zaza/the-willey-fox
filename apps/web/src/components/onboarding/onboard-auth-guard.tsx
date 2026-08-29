'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getAccessToken, getRefreshToken } from '@/lib/auth';

/** Ensure onboarding pages are only used while signed in. */
export function OnboardAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const hasToken = Boolean(getAccessToken() || getRefreshToken());
    if (!user && !hasToken) {
      router.replace('/login?redirect=/onboard/welcome');
    }
  }, [user, loading, router]);

  if (loading || (!user && !(getAccessToken() || getRefreshToken()))) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#f0e7d6' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ea2e00] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
