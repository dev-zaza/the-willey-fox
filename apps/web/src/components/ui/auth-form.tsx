'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProps) {
  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get('error');
    if (!code) return;
    const copy: Record<string, string> = {
      oauth_failed: 'Google sign-in did not finish. Please try again.',
      oauth_api_unreachable:
        'Could not reach the API after Google sign-in. Confirm the backend is running (e.g. port 3002) and NEXT_PUBLIC_API_URL matches.',
      oauth_code_expired: 'That sign-in link expired. Please use Sign in with Google again.',
    };
    setError(copy[code] ?? 'Sign-in failed. Please try again.');
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const loggedInUser = await login(email, password);
        router.push(loggedInUser.isAdmin ? '/admin' : redirect);
      } else {
        const res = await register({ email, password, firstName: firstName.trim(), lastName: lastName.trim() });
        setSuccessMsg(res.message + ' You can now sign in.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-lg px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#ea2e00]/30 focus:border-[#ea2e00]';
  const inputStyle: React.CSSProperties = {
    background: '#ffffff',
    color: '#1b1410',
    border: '1px solid rgba(27,20,16,0.12)',
  };
  const labelStyle: React.CSSProperties = { color: '#5a4a3d' };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#f0e7d6', color: '#1b1410' }}
    >
      {/* Soft warm grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(234,46,0,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black, transparent)',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="TheWileyfox" width={48} height={48} className="rounded-xl mb-3" />
          <h1
            className="text-3xl tracking-tight"
            style={{
              fontFamily: 'var(--font-display, Georgia, serif)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#1b1410',
            }}
          >
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm mt-1.5" style={{ color: '#7a6957' }}>
            {mode === 'login'
              ? 'Sign in to your TheWileyfox account'
              : 'Start protecting what matters to you'}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(27,20,16,0.08)',
            boxShadow: '0 18px 38px -14px rgba(80,40,15,0.18), 0 2px 6px rgba(80,40,15,0.06)',
          }}
        >
          {successMsg ? (
            <div className="text-center space-y-4">
              <p
                className="text-sm rounded-lg px-4 py-3"
                style={{
                  color: '#0e8b5e',
                  background: 'rgba(14,139,94,0.08)',
                  border: '1px solid rgba(14,139,94,0.2)',
                }}
              >
                {successMsg}
              </p>
              <Link
                href={`/login${redirect !== '/dashboard' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                className="block w-full text-white font-semibold py-2.5 rounded-lg transition-colors text-center text-sm hover:bg-brand-600"
                style={{ background: '#ea2e00' }}
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
                      First name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      required
                      minLength={2}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
                      Last name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      required
                      minLength={2}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={labelStyle}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              {error && (
                <p
                  className="text-sm rounded-lg px-3 py-2"
                  style={{
                    color: '#b91c1c',
                    background: 'rgba(220,38,38,0.08)',
                    border: '1px solid rgba(220,38,38,0.2)',
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-semibold py-2.5 rounded-lg transition-colors mt-2 hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: '#ea2e00' }}
              >
                {loading
                  ? mode === 'login' ? 'Signing in…' : 'Creating account…'
                  : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full" style={{ borderTop: '1px solid rgba(27,20,16,0.1)' }} />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2" style={{ background: '#ffffff', color: '#9d8c7a' }}>or continue with</span>
                </div>
              </div>

              <a
                href={`${API_BASE}/auth/google`}
                className="flex items-center justify-center gap-3 w-full font-medium py-2.5 rounded-lg transition-colors text-sm"
                style={{
                  background: '#ffffff',
                  color: '#1b1410',
                  border: '1px solid rgba(27,20,16,0.15)',
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </a>
            </form>
          )}
        </div>

        {/* Switch link */}
        {!successMsg && (
          <p className="text-center text-sm mt-6" style={{ color: '#7a6957' }}>
            {mode === 'login' ? (
              <>
                {"Don't have an account? "}
                <Link
                  href={`/register${redirect !== '/dashboard' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                  className="font-semibold transition-colors hover:underline"
                  style={{ color: '#ea2e00' }}
                >
                  Sign up free
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link
                  href={`/login${redirect !== '/dashboard' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
                  className="font-semibold transition-colors hover:underline"
                  style={{ color: '#ea2e00' }}
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
