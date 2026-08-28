'use client';

import Link from 'next/link';
import { useState } from 'react';
import { users as usersApi } from '@/lib/api';

export default function PhoneVerifyPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function sendOtp() {
    if (!phone.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await usersApi.sendPhoneOtp(phone.trim());
      setMessage(res.message);
      setStep('code');
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!phone.trim() || !code.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await usersApi.verifyPhoneOtp(phone.trim(), code.trim());
      setMessage(res.message || 'Phone verified');
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="border-b border-surface-border bg-surface-card px-4 py-4">
        <Link href="/dashboard/settings" className="text-sm text-[#7a6957] hover:text-brand-400">
          ← Settings
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">Verify phone</h1>
      </div>

      <div className="mx-auto max-w-md space-y-4 p-4">
        {step === 'phone' ? (
          <>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 900000"
              className="w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2.5 text-sm text-white"
            />
            <button
              type="button"
              onClick={sendOtp}
              disabled={loading}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send verification code'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-[#7a6957]">Code sent to {phone}</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              className="w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2.5 text-sm text-white"
            />
            <button
              type="button"
              onClick={verifyOtp}
              disabled={loading}
              className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </>
        )}
        {message && <p className="text-sm text-[#5a4a3d]">{message}</p>}
      </div>
    </div>
  );
}
