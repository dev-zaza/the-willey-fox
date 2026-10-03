'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isProTier } from '@safetag/shared';
import { useAuth } from '@/context/auth-context';
import { getAccessToken } from '@/lib/auth';

type Phase =
  | 'loading'
  | 'login'
  | 'upgrade'
  | 'coming_soon'
  | 'invalid_code'
  | 'error'
  | 'ready';

interface GuideGateProps {
  citySlug: string;
  /** When set, load this coded URL; when omitted, resolve access code for Pro users. */
  accessCode?: string;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function GuideGate({ citySlug, accessCode: accessCodeProp }: GuideGateProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('');
  const [html, setHtml] = useState<string | null>(null);
  const cityLabel = titleCaseSlug(citySlug);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setPhase('login');
      return;
    }

    if (!isProTier(user.subscriptionTier)) {
      setPhase('upgrade');
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setPhase('login');
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        let code = accessCodeProp?.trim().toUpperCase() || '';

        if (!code) {
          const accessRes = await fetch(`/api/guides/${encodeURIComponent(citySlug)}/access`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          if (cancelled) return;
          if (accessRes.status === 401) {
            setPhase('login');
            return;
          }
          if (accessRes.status === 403) {
            setPhase('upgrade');
            return;
          }
          if (!accessRes.ok) {
            setPhase('error');
            setMessage('Could not open this guide. Try again shortly.');
            return;
          }
          const access = (await accessRes.json()) as {
            available: boolean;
            accessCode: string;
            path: string;
          };
          if (!access.available) {
            setPhase('coming_soon');
            return;
          }
          // Put unique code in the URL for Pro share/bookmark links
          router.replace(access.path);
          return;
        }

        const res = await fetch(
          `/api/guides/${encodeURIComponent(citySlug)}/${encodeURIComponent(code)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          },
        );
        if (cancelled) return;

        if (res.status === 401) {
          setPhase('login');
          return;
        }
        if (res.status === 403) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          if (body.message?.toLowerCase().includes('upgrade') || body.message?.toLowerCase().includes('pro')) {
            setPhase('upgrade');
          } else {
            setPhase('invalid_code');
            setMessage(body.message || 'Invalid guide access code.');
          }
          return;
        }
        if (res.status === 404) {
          setPhase('coming_soon');
          return;
        }
        if (!res.ok) {
          setPhase('error');
          setMessage('Could not load this guide. Try again shortly.');
          return;
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
          setPhase('coming_soon');
          return;
        }
        const body = await res.text();
        if (cancelled) return;
        setHtml(body);
        setPhase('ready');
      } catch {
        if (!cancelled) {
          setPhase('error');
          setMessage('Could not reach the server. Try again shortly.');
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, citySlug, accessCodeProp, router]);

  if (phase === 'loading' || authLoading) {
    return (
      <Shell>
        <p className="text-sm text-[#8A7B67]">Checking access…</p>
      </Shell>
    );
  }

  if (phase === 'login') {
    const redirect = accessCodeProp
      ? `/guides/${citySlug}/${accessCodeProp}`
      : `/guides/${citySlug}`;
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold text-[#17130F]">{cityLabel} travel guide</h1>
        <p className="mt-2 text-sm text-[#5C5245]">Sign in with a Pro account to open this guide.</p>
        <Link
          href={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="mt-6 inline-flex rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white"
        >
          Sign in
        </Link>
      </Shell>
    );
  }

  if (phase === 'upgrade') {
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold text-[#17130F]">{cityLabel} travel guide</h1>
        <p className="mt-2 text-sm text-[#5C5245]">
          Full city travel guides are included with Pro. Upgrade to unlock London, Munich, Nuremberg and more.
        </p>
        <Link
          href="/dashboard/subscription"
          className="mt-6 inline-flex rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white"
        >
          Upgrade to Pro
        </Link>
        <Link href="/dashboard" className="mt-3 block text-sm font-semibold text-[#5C5245]">
          ← Back to map
        </Link>
      </Shell>
    );
  }

  if (phase === 'coming_soon') {
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold text-[#17130F]">{cityLabel}</h1>
        <p className="mt-3 text-base font-semibold text-[#17130F]">Guide will be updated soon</p>
        <p className="mt-2 text-sm text-[#5C5245]">
          We&apos;re finishing the full travel guide for this city. Area tips and safety scores on the map still work
          for Pro members.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-xl border border-[#E3D8C6] bg-white px-4 py-2.5 text-sm font-bold text-[#17130F]"
        >
          ← Back to map
        </Link>
      </Shell>
    );
  }

  if (phase === 'invalid_code' || phase === 'error') {
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold text-[#17130F]">{cityLabel}</h1>
        <p className="mt-2 text-sm text-[#5C5245]">{message || 'Something went wrong.'}</p>
        <Link href={`/guides/${citySlug}`} className="mt-6 inline-flex text-sm font-bold text-brand-600">
          Request a fresh Pro guide link →
        </Link>
      </Shell>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4E5]">
      <div className="flex items-center justify-between border-b border-[#E3D8C6] bg-white px-4 py-3 print:hidden">
        <Link href="/dashboard" className="text-sm font-bold text-[#17130F]">
          ← Map
        </Link>
        <span className="text-xs font-extrabold tracking-wider text-[#8A7B67]">PRO GUIDE</span>
      </div>
      <iframe
        title={`${cityLabel} travel guide`}
        srcDoc={html ?? ''}
        className="h-[calc(100vh-52px)] w-full border-0 bg-white"
        sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1E7D8] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E3D8C6] bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}
