'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { isOnboardingDone, resolvePostAuthPath } from '@/lib/onboarding';

/**
 * Redirects authenticated users who still need family onboarding
 * away from the dashboard into /onboard/welcome.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setReady(true);
      return;
    }
    if (user.isAdmin || isOnboardingDone()) {
      setReady(true);
      return;
    }

    let cancelled = false;
    resolvePostAuthPath({ isAdmin: user.isAdmin, fallback: '/dashboard' }).then((path) => {
      if (cancelled) return;
      if (path.startsWith('/onboard') && !pathname?.startsWith('/onboard')) {
        router.replace(path);
        return;
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [user, loading, router, pathname]);

  if (loading || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
