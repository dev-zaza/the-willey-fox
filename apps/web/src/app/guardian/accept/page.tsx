'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

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

    const authToken = typeof window !== 'undefined' ? localStorage.getItem('safetag_access_token') : null;
    if (!authToken) {
      router.push(`/login?redirect=${encodeURIComponent('/guardian/accept?token=' + token)}`);
      return;
    }

    (async () => {
      try {
        // The token encodes the invite; we need to find the qrCodeId from the invite.
        // Backend endpoint: POST /qr/:qrCodeId/guardians/invite/accept { token }
        // Since qrCodeId is unknown here, backend exposes a top-level accept endpoint.
        // We call POST /guardians/invite/accept { token }
        const res = await fetch(`${BASE_URL}/guardians/invite/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const code = data?.message ?? data?.code ?? 'Unknown error';
          if (code === 'INVITE_EXPIRED') {
            throw new Error('This invite has expired. Please ask the QR owner to send a new one.');
          }
          if (code === 'INVITE_ALREADY_USED') {
            throw new Error('This invite has already been used.');
          }
          if (code === 'OWNER_CANNOT_BE_GUARDIAN') {
            throw new Error('You cannot be a guardian of your own QR code.');
          }
          throw new Error(code);
        }

        setStatus('success');
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Something went wrong.');
      }
    })();
  }, [token, router]);

  if (status === 'loading') {
    return (
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={styles.text}>Accepting guardian invite…</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={styles.card}>
        <div style={styles.icon}>✓</div>
        <h1 style={styles.title}>You're a Guardian!</h1>
        <p style={styles.text}>You've been added as a guardian for this item. You'll be notified if it's found.</p>
        <a href="/dashboard/qr" style={styles.button}>View My QR Codes</a>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={{ ...styles.icon, backgroundColor: '#ef4444' }}>✕</div>
      <h1 style={styles.title}>Invite Failed</h1>
      <p style={styles.text}>{message || 'Unable to accept this guardian invite.'}</p>
      <a href="/dashboard" style={styles.button}>Go to Dashboard</a>
    </div>
  );
}

export default function GuardianAcceptPage() {
  return (
    <div style={styles.page}>
      <Suspense fallback={
        <div style={styles.card}>
          <div style={styles.spinner} />
        </div>
      }>
        <AcceptContent />
      </Suspense>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    padding: '24px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '48px 32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
  },
  icon: {
    width: '72px',
    height: '72px',
    lineHeight: '72px',
    fontSize: '32px',
    backgroundColor: '#ea2e00',
    color: '#fff',
    borderRadius: '50%',
    margin: '0 auto 20px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#ea2e00',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px',
  },
  title: {
    margin: '0 0 12px',
    fontSize: '22px',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  text: {
    margin: '0 0 24px',
    fontSize: '15px',
    color: '#666',
    lineHeight: '1.5',
  },
  button: {
    display: 'inline-block',
    padding: '12px 28px',
    backgroundColor: '#ea2e00',
    color: '#fff',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '15px',
  },
};
