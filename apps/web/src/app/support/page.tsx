'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { support } from '@/lib/api';
import { FaqSection } from '@/components/landing/faq-section';

export default function SupportPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user ? `${user.firstName} ${user.lastName}`.trim() : '',
    email: user?.email ?? '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await support.submitTicket(form);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#f0e7d6', color: '#1b1410' }}>
      {/* Nav */}
      <nav
        className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto"
        style={{ borderBottom: '1px solid rgba(27,20,16,0.08)' }}
      >
        <Link
          href="/"
          className="text-lg font-bold"
          style={{ color: '#ea2e00', fontFamily: 'var(--font-display, Georgia, serif)' }}
        >
          TheWileyfox
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm transition-colors" style={{ color: '#5a4a3d' }}>
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm text-white font-semibold px-4 py-2 rounded-lg transition-colors hover:bg-brand-600"
            style={{ background: '#ea2e00' }}
          >
            Get started free
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <span
            className="text-[11px] font-mono uppercase tracking-[0.18em] block mb-3"
            style={{ color: '#9d8c7a' }}
          >
            Support
          </span>
          <h1
            className="text-4xl md:text-5xl tracking-tight mb-4"
            style={{
              fontFamily: 'var(--font-display, Georgia, serif)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            How can we help?
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#5a4a3d' }}>
            Check the FAQ below, or send us a message and we&apos;ll get back to you as soon as we can.
          </p>
        </div>

        {/* Ticket form */}
        <div
          className="rounded-2xl p-7 sm:p-9 mb-6"
          style={{ background: '#ffffff', border: '1px solid rgba(27,20,16,0.08)' }}
        >
          {submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: '#0e8b5e' }} />
              <h2
                className="text-2xl mb-2"
                style={{ fontFamily: 'var(--font-display, Georgia, serif)', fontWeight: 700 }}
              >
                Message sent
              </h2>
              <p style={{ color: '#5a4a3d' }}>
                Thanks for reaching out — we&apos;ve emailed you a confirmation and will follow up shortly.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setForm((f) => ({ ...f, subject: '', message: '' }));
                }}
                className="mt-6 text-sm font-semibold hover:underline"
                style={{ color: '#ea2e00' }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3d2b1a' }}>
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
                    style={{ border: '1px solid #e8ddd3', background: '#fdf9f5', color: '#1b1410' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3d2b1a' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
                    style={{ border: '1px solid #e8ddd3', background: '#fdf9f5', color: '#1b1410' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3d2b1a' }}>
                  Subject
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="What's this about?"
                  className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
                  style={{ border: '1px solid #e8ddd3', background: '#fdf9f5', color: '#1b1410' }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3d2b1a' }}>
                  Message
                </label>
                <textarea
                  required
                  rows={6}
                  maxLength={5000}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Tell us what's going on..."
                  className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors resize-none"
                  style={{ border: '1px solid #e8ddd3', background: '#fdf9f5', color: '#1b1410' }}
                />
              </div>

              {error && (
                <p className="text-sm rounded-lg px-4 py-3" style={{ background: '#fff5f2', color: '#c0392b' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: '#ea2e00' }}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm mb-4" style={{ color: '#9d8c7a' }}>
          You can also reach us directly at{' '}
          <a href="mailto:support@thewileyfox.com" className="hover:underline" style={{ color: '#ea2e00' }}>
            support@thewileyfox.com
          </a>
        </p>
      </main>

      <FaqSection />

      <footer
        className="py-14 px-4"
        style={{ background: '#f0e7d6', borderTop: '1px solid rgba(27,20,16,0.08)' }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <span className="text-sm" style={{ color: '#7a6957' }}>
            © {new Date().getFullYear()} TheWileyfox. Reuniting strangers since today.
          </span>
          <div className="flex gap-7 text-sm" style={{ color: '#7a6957' }}>
            <Link href="/privacy-policy" className="transition-colors hover:text-[#ea2e00]">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[#ea2e00]">
              Terms
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-[#ea2e00]">
              Pricing
            </Link>
            <Link href="/" className="transition-colors hover:text-[#ea2e00]">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
