'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Shield, ShieldCheck, ChevronLeft } from 'lucide-react';
import { twoFactor } from '@/lib/api';

type Step = 'idle' | 'setup' | 'verify' | 'disable';

export default function SecuritySettingsPage() {
  const [step, setStep] = useState<Step>('idle');
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  async function startSetup() {
    setError('');
    setLoading(true);
    try {
      const res = await twoFactor.setup();
      setQrCode(res.qrCode);
      setSecret(res.secret);
      setStep('setup');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to start 2FA setup');
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnable() {
    if (code.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      await twoFactor.enable(code);
      setIs2faEnabled(true);
      setStep('idle');
      setCode('');
      setSuccess('Two-factor authentication has been enabled.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) {
      setError(e?.message ?? 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDisable() {
    if (code.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      await twoFactor.disable(code);
      setIs2faEnabled(false);
      setStep('idle');
      setCode('');
      setSuccess('Two-factor authentication has been disabled.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) {
      setError(e?.message ?? 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings"
            className="text-[#7a6957] hover:text-[#5a4a3d] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Security</h1>
            <p className="text-[#7a6957] text-sm mt-0.5">Manage two-factor authentication</p>
          </div>
        </div>

        {success && (
          <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
            {success}
          </p>
        )}

        {/* 2FA Status Card */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-5">
          <div className="flex items-start gap-4">
            <div className={`p-2.5 rounded-xl ${is2faEnabled ? 'bg-green-500/10' : 'bg-surface-elevated'}`}>
              {is2faEnabled
                ? <ShieldCheck className="w-6 h-6 text-green-400" />
                : <Shield className="w-6 h-6 text-[#7a6957]" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white text-sm">Authenticator App (TOTP)</p>
              <p className="text-[#7a6957] text-xs mt-0.5">
                {is2faEnabled
                  ? 'Two-factor authentication is active.'
                  : 'Add an extra layer of security to your account with an authenticator app like Google Authenticator or Authy.'}
              </p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${is2faEnabled ? 'bg-green-500/10 text-green-400' : 'bg-surface-elevated text-[var(--text-muted)]'}`}>
              {is2faEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {/* ── Setup flow ── */}
          {step === 'idle' && !is2faEnabled && (
            <button
              onClick={startSetup}
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading ? 'Loading…' : 'Set up 2FA'}
            </button>
          )}

          {step === 'setup' && (
            <div className="space-y-4">
              <p className="text-[#5a4a3d] text-sm">
                Scan this QR code with your authenticator app, then enter the 6-digit code below.
              </p>
              <div className="flex justify-center">
                <Image
                  src={qrCode}
                  alt="2FA QR Code"
                  width={200}
                  height={200}
                  className="rounded-xl bg-white p-2"
                />
              </div>
              <div className="text-center">
                <p className="text-xs text-[#9d8c7a] mb-1">Manual entry key</p>
                <code className="text-xs font-mono text-[#5a4a3d] bg-surface-elevated px-3 py-1.5 rounded-lg break-all">
                  {secret}
                </code>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#7a6957]">Verification code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full bg-surface border border-surface-border text-white text-center text-lg font-mono tracking-widest rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500"
                />
              </div>
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('idle'); setCode(''); setError(''); }}
                  className="flex-1 border border-surface-border text-[#7a6957] hover:text-[#5a4a3d] font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmEnable}
                  disabled={loading || code.length !== 6}
                  className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {loading ? 'Verifying…' : 'Enable 2FA'}
                </button>
              </div>
            </div>
          )}

          {/* ── Disable flow ── */}
          {step === 'idle' && is2faEnabled && (
            <button
              onClick={() => setStep('disable')}
              className="w-full border border-red-500/40 hover:border-red-500/60 text-red-400 hover:text-red-300 font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              Disable 2FA
            </button>
          )}

          {step === 'disable' && (
            <div className="space-y-4">
              <p className="text-[#5a4a3d] text-sm">
                Enter the current 6-digit code from your authenticator app to disable 2FA.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#7a6957]">Verification code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full bg-surface border border-surface-border text-white text-center text-lg font-mono tracking-widest rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500"
                />
              </div>
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('idle'); setCode(''); setError(''); }}
                  className="flex-1 border border-surface-border text-[#7a6957] hover:text-[#5a4a3d] font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDisable}
                  disabled={loading || code.length !== 6}
                  className="flex-1 border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-60 text-red-400 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {loading ? 'Verifying…' : 'Confirm Disable'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
