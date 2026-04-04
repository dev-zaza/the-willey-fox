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
    return <span className="text-sm text-white">{resolved}</span>;
  }
  return resolved ? (
    <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
  ) : (
    <XCircle className="w-5 h-5 text-slate-600 mx-auto" />
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

  const { monthlyPriceLabel, annualPriceLabel, annualSavePercent, trialDays } = pricing;

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-lg font-bold text-[#f97316]">
          TheWileyfox
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm text-slate-400 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="text-sm bg-[#f97316] hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, honest pricing</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Start free and upgrade when you need more. No hidden fees.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Free */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col">
            <div className="mb-6">
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Free</p>
              <p className="text-4xl font-bold">$0</p>
              <p className="text-slate-500 text-sm mt-1">Forever free</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> {pricing.tierLimits.free.maxQrCodes} QR tags
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> {pricing.tierLimits.free.maxEmergencyContacts} emergency contacts
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Community safety map
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Basic safety alerts
              </li>
            </ul>
            <Link
              href="/auth/register"
              className="block text-center bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Monthly */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-7 flex flex-col">
            <div className="mb-6">
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Pro Monthly</p>
              <p className="text-4xl font-bold">${(pricing.monthlyPriceCents / 100).toFixed(2)}</p>
              <p className="text-slate-500 text-sm mt-1">per month · {trialDays}-day free trial</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Unlimited QR tags
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> {pricing.tierLimits.premium.maxEmergencyContacts} emergency contacts
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Safety-aware routing
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> SOS push to contacts
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Medical alert on tag
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Full report history
              </li>
            </ul>
            <Link
              href="/dashboard/subscription"
              className="block text-center bg-[#f97316] hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Start {trialDays}-day Free Trial
            </Link>
          </div>

          {/* Pro Annual */}
          <div className="bg-white/5 border border-[#f97316]/40 rounded-2xl p-7 flex flex-col relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-[#f97316] text-white text-xs font-bold px-2.5 py-1 rounded-full">
              Save {annualSavePercent}%
            </div>
            <div className="mb-6">
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Pro Annual</p>
              <p className="text-4xl font-bold">${(pricing.annualPriceCents / 100).toFixed(2)}</p>
              <p className="text-slate-500 text-sm mt-1">per year · ~${((pricing.annualPriceCents / 100) / 12).toFixed(0)}/mo</p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Everything in Pro Monthly
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> {annualSavePercent}% annual discount
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Priority support
              </li>
            </ul>
            <Link
              href="/dashboard/subscription"
              className="block text-center bg-[#f97316] hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Start {trialDays}-day Free Trial
            </Link>
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-4 text-sm font-semibold text-slate-400 uppercase tracking-wider px-6 py-4 border-b border-white/10">
            <div className="col-span-2">Feature</div>
            <div className="text-center">Free</div>
            <div className="text-center text-[#f97316]">Pro</div>
          </div>
          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              className={`grid grid-cols-4 items-center px-6 py-3.5 text-sm ${
                i % 2 === 0 ? '' : 'bg-white/[0.02]'
              }`}
            >
              <div className="col-span-2 text-slate-300">{f.label}</div>
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
          <p className="text-slate-400 mb-6">
            Questions? <a href="mailto:support@thewileyfox.com" className="text-[#f97316] hover:underline">Contact us</a>
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-[#f97316] hover:bg-orange-600 text-white font-bold px-10 py-4 rounded-xl text-lg transition-colors"
          >
            Get Started Free — No credit card required
          </Link>
        </div>
      </main>
    </div>
  );
}
