'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

type State = 'idle' | 'loading' | 'success' | 'active_subscription' | 'error';

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('loading');

    try {
      const res = await fetch(`${API_URL}/public/account-deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setState('success');
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data?.message === 'ACTIVE_SUBSCRIPTION') {
        setState('active_subscription');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Request Account Deletion</h1>
            <p className="mt-2 text-sm text-gray-500">
              Under GDPR and applicable data protection law, you have the right to request deletion of your
              personal data. Enter the email address associated with your SafeTag account below.
            </p>
          </div>

          {state === 'success' ? (
            <div className="rounded-xl bg-green-50 border border-green-200 p-5 text-center">
              <div className="text-3xl mb-3">✓</div>
              <p className="font-semibold text-green-800">Request received</p>
              <p className="mt-1 text-sm text-green-700">
                If an account exists for that email address, you will receive a confirmation email.
                Your account and all associated data will be permanently deleted within 90 days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={state === 'loading'}
                />
              </div>

              {state === 'active_subscription' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  Your account has an active paid subscription. Please cancel your subscription first before
                  requesting account deletion.
                </div>
              )}

              {state === 'error' && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                  Something went wrong. Please try again or contact{' '}
                  <a href="mailto:support@thewileyfox.com" className="underline">
                    support@thewileyfox.com
                  </a>
                  .
                </div>
              )}

              <button
                type="submit"
                disabled={state === 'loading' || !email}
                className="w-full rounded-lg bg-red-600 text-white font-semibold py-2.5 text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {state === 'loading' ? 'Submitting…' : 'Request account deletion'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Deletion is permanent and cannot be undone. All your data including QR codes, family
                groups, and history will be removed within 90 days.
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Questions?{' '}
          <a href="mailto:privacy@thewileyfox.com" className="underline hover:text-gray-600">
            privacy@thewileyfox.com
          </a>
        </p>
      </div>
    </main>
  );
}
