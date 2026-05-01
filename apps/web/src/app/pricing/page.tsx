'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle } from 'lucide-react';
import { settings, type PricingConfig } from '@/lib/api';

const FEATURES = [
  { label: 'QR Tags', free: (p: PricingConfig) => `${p.tierLimits.free.maxQrCodes} tags`, pro: 'Unlimited tags' },
  { label: 'Emergency contacts', free: (p: PricingConfig) => `${p.tierLimits.free.maxEmergencyContacts} contacts`, pro: (p: PricingConfig) => `${p.tierLimits.premium.maxEmergencyContacts} contacts` },
  { label: 'Community safety map', free: true, pro: true },
  { label: 'Basic safety alerts', free: true, pro: true },
  { label: 'Safety-aware routing', free: false, pro: true },
  { label: 'Priority notifications', free: false, pro: true },
  { label: 'SOS push to contacts', free: false, pro: true },
  { label: 'Full report history', free: false, pro: true },
  { label: 'Bulk QR generation', free: false, pro: true },
  { label: 'Medical alert on tag', free: false, pro: true },
] as const;

type FeatureValue = boolean | string | ((p: PricingConfig) => string);

function FeatureCell({ value, pricing }: { value: FeatureValue; pricing: PricingConfig }) {
  const resolved = typeof value === 'function' ? value(pricing) : value;
  if (typeof resolved === 'string') {
    return <span className="text-sm text-[#1b1410]">{resolved}</span>;
  }
  return resolved ? (
    <CheckCircle className="w-5 h-5 text-[#0e8b5e] mx-auto" />
  ) : (
    <XCircle className="w-5 h-5 text-[#9d8c7a] mx-auto" />
  );
}

const FALLBACK: PricingConfig = {
  monthlyPriceCents: 999,
  annualPriceCents: 9599,
  monthlyPriceLabel: '$9.99/month',
  annualPriceLabel: '$95.99/year',
  annualSavePercent: 20,
  trialDays: 7,
  stripePriceIdMonthly: '',
  stripePriceIdAnnual: '',
  tierLimits: {
    free:    { maxQrCodes: 5,  maxGuardians: 2,  maxEmergencyContacts: 3,  maxPinsPerDay: 5 },
    basic:   { maxQrCodes: 10, maxGuardians: 5,  maxEmergencyContacts: 10, maxPinsPerDay: 20 },
    premium: { maxQrCodes: 50, maxGuardians: 20, maxEmergencyContacts: 25, maxPinsPerDay: 100 },
  },
};

export default function PricingPage() {
  const [pricing, setPricing] = useState<PricingConfig>(FALLBACK);

  useEffect(() => {
    settings.getPricing().then(setPricing).catch(() => {});
  }, []);

  const { annualSavePercent, trialDays } = pricing;

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

      <main className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1
            className="text-4xl md:text-5xl tracking-tight mb-4"
            style={{
              fontFamily: 'var(--font-display, Georgia, serif)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Simple, honest pricing
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#5a4a3d' }}>
            Start free and upgrade when you need more. No hidden fees.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Free */}
          <div
            className="rounded-2xl p-7 flex flex-col"
            style={{ background: '#ffffff', border: '1px solid rgba(27,20,16,0.08)' }}
          >
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: '#9d8c7a' }}>Free</p>
              <p
                className="text-4xl tracking-tight"
                style={{ fontFamily: 'var(--font-display, Georgia, serif)', fontWeight: 700, color: '#1b1410' }}
              >
                $0
              </p>
              <p className="text-sm mt-1" style={{ color: '#7a6957' }}>Forever free</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-sm" style={{ color: '#5a4a3d' }}>
                <CheckCircle className="w-4 h-4 text-[#0e8b5e] flex-shrink-0 mt-0.5" /> {pricing.tierLimits.free.maxQrCodes} QR tags
              </li>
              <li className="flex items-start gap-2 text-sm" style={{ color: '#5a4a3d' }}>
                <CheckCircle className="w-4 h-4 text-[#0e8b5e] flex-shrink-0 mt-0.5" /> {pricing.tierLimits.free.maxEmergencyContacts} emergency contacts
              </li>
              <li className="flex items-start gap-2 text-sm" style={{ color: '#5a4a3d' }}>
                <CheckCircle className="w-4 h-4 text-[#0e8b5e] flex-shrink-0 mt-0.5" /> Community safety map
              </li>
              <li className="flex items-start gap-2 text-sm" style={{ color: '#5a4a3d' }}>
                <CheckCircle className="w-4 h-4 text-[#0e8b5e] flex-shrink-0 mt-0.5" /> Basic safety alerts
              </li>
            </ul>
            <Link
              href="/register"
              className="block text-center font-semibold py-3 rounded-xl transition-colors"
              style={{
                border: '1px solid rgba(27,20,16,0.15)',
                color: '#1b1410',
                background: '#ffffff',
              }}
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Monthly */}
          <div
            className="rounded-2xl p-7 flex flex-col"
            style={{ background: '#ffffff', border: '1px solid rgba(27,20,16,0.08)' }}
          >
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: '#9d8c7a' }}>Pro Monthly</p>
              <p
                className="text-4xl tracking-tight"
                style={{ fontFamily: 'var(--font-display, Georgia, serif)', fontWeight: 700, color: '#1b1410' }}
              >
                ${(pricing.monthlyPriceCents / 100).toFixed(2)}
              </p>
              <p className="text-sm mt-1" style={{ color: '#7a6957' }}>
                per month · {trialDays}-day free trial
              </p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-sm" style={{ color: '#5a4a3d' }}>
                <CheckCircle className="w-4 h-4 text-[#0e8b5e] flex-shrink-0 mt-0.5" /> Unlimited QR tags
              </li>
              <li className="flex items-start gap-2 text-sm" style={{ color: '#5a4a3d' }}>
                <CheckCircle className="w-4 h-4 text-[#0e8b5e] flex-shrink-0 mt-0.5" /> {pricing.tierLimits.premium.maxEmergencyContacts} emergency contacts
              </li>
              <li className="flex items-start gap-2 text-sm" style={{ color: '#5a4a3d' }}>
                <CheckCircle className="w-4 h-4 text-[#0e8b5e] flex-shrink-0 mt-0.5" /> Safety-aware routing
              </li>
              <li className="flex items-start gap-2 text-sm" style={{ color: '#5a4a3d' }}>
                <CheckCircle className="w-4 h-4 text-[#0e8b5e] flex-shrink-0 mt-0.5" /> SOS push to contacts
              </li>
              <li className="flex items-start gap-2 text-sm" style={{ color: '#5a4a3d' }}>
                <CheckCircle className="w-4 h-4 text-[#0e8b5e] flex-shrink-0 mt-0.5" /> Medical alert on tag
              </li>
              <li className="flex items-start gap-2 text-sm" style={{ color: '#5a4a3d' }}>
                <CheckCircle className="w-4 h-4 text-[#0e8b5e] flex-shrink-0 mt-0.5" /> Full report history
              </li>
            </ul>
            <Link
              href="/dashboard/subscription"
              className="block text-center text-white font-semibold py-3 rounded-xl transition-colors hover:bg-brand-600"
              style={{ background: '#ea2e00' }}
            >
              Start {trialDays}-day Free Trial
            </Link>
          </div>

          {/* Pro Annual — recommended */}
          <div
            className="relative rounded-2xl p-7 flex flex-col overflow-hidden"
            style={{
              background: '#1b1410',
              color: '#f0e7d6',
              boxShadow: '0 18px 38px -14px rgba(80,40,15,0.32)',
            }}
          >
            <div
              className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: '#ea2e00', color: '#1b1410' }}
            >
              Save {annualSavePercent}%
            </div>
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(240,231,214,0.6)' }}>
                Pro Annual
              </p>
              <p
                className="text-4xl tracking-tight"
                style={{
                  fontFamily: 'var(--font-display, Georgia, serif)',
                  fontWeight: 700,
                  color: '#ea2e00',
                  letterSpacing: '-0.02em',
                }}
              >
                ${(pricing.annualPriceCents / 100).toFixed(2)}
              </p>
              <p className="text-sm mt-1" style={{ color: 'rgba(240,231,214,0.6)' }}>
                per year · ~${((pricing.annualPriceCents / 100) / 12).toFixed(0)}/mo
              </p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-sm" style={{ color: 'rgba(240,231,214,0.85)' }}>
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ea2e00' }} /> Everything in Pro Monthly
              </li>
              <li className="flex items-start gap-2 text-sm" style={{ color: 'rgba(240,231,214,0.85)' }}>
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ea2e00' }} /> {annualSavePercent}% annual discount
              </li>
              <li className="flex items-start gap-2 text-sm" style={{ color: 'rgba(240,231,214,0.85)' }}>
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ea2e00' }} /> Priority support
              </li>
            </ul>
            <Link
              href="/dashboard/subscription"
              className="block text-center font-semibold py-3 rounded-xl transition-opacity hover:opacity-90"
              style={{ background: '#ea2e00', color: '#1b1410' }}
            >
              Start {trialDays}-day Free Trial
            </Link>
          </div>
        </div>

        {/* Feature comparison table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#ffffff', border: '1px solid rgba(27,20,16,0.08)' }}
        >
          <div
            className="grid grid-cols-4 text-sm font-semibold uppercase tracking-wider px-6 py-4"
            style={{ color: '#9d8c7a', borderBottom: '1px solid rgba(27,20,16,0.08)' }}
          >
            <div className="col-span-2">Feature</div>
            <div className="text-center">Free</div>
            <div className="text-center" style={{ color: '#ea2e00' }}>Pro</div>
          </div>
          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              className="grid grid-cols-4 items-center px-6 py-3.5 text-sm"
              style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(27,20,16,0.02)' }}
            >
              <div className="col-span-2" style={{ color: '#5a4a3d' }}>{f.label}</div>
              <div className="text-center">
                <FeatureCell value={f.free} pricing={pricing} />
              </div>
              <div className="text-center">
                <FeatureCell value={f.pro} pricing={pricing} />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="mb-6" style={{ color: '#5a4a3d' }}>
            Questions?{' '}
            <a href="mailto:support@thewileyfox.com" className="hover:underline" style={{ color: '#ea2e00' }}>
              Contact us
            </a>
          </p>
          <Link
            href="/register"
            className="inline-block text-white font-bold px-10 py-4 rounded-xl text-lg transition-colors hover:bg-brand-600"
            style={{ background: '#ea2e00' }}
          >
            Get Started Free — No credit card required
          </Link>
        </div>
      </main>
    </div>
  );
}
