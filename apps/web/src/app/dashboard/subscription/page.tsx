'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Zap, Crown, XCircle, CreditCard, RefreshCw } from 'lucide-react';
import { payments, settings, type SubscriptionStatus, type Invoice, type PricingConfig } from '@/lib/api';

const PRICING_FALLBACK: PricingConfig = {
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

export default function SubscriptionPage() {
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pricing, setPricing] = useState<PricingConfig>(PRICING_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<'month' | 'year' | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [switchingInterval, setSwitchingInterval] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    Promise.all([payments.getSubscription(), payments.getInvoices(), settings.getPricing()])
      .then(([s, i, p]) => { setSub(s); setInvoices(i); setPricing(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function checkout(interval: 'month' | 'year') {
    setCheckoutLoading(interval);
    try {
      const { url } = await payments.createCheckout(interval);
      window.location.href = url;
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create checkout session');
      setCheckoutLoading(null);
    }
  }

  async function cancel() {
    if (!confirm('Cancel subscription at period end?')) return;
    setCancelling(true);
    try {
      await payments.cancelSubscription();
      setSub((prev) => prev ? { ...prev, cancelAtPeriodEnd: true } : prev);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  }

  const isPro = sub?.tier === 'premium' || sub?.tier === 'pro';
  const isActive = sub?.status === 'active' || sub?.status === 'trialing';
  const annualPriceId = pricing.stripePriceIdAnnual || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL;
  const isAnnual = annualPriceId
    ? sub?.subscription?.stripePriceId === annualPriceId
    : false;

  async function switchInterval(interval: 'monthly' | 'annual') {
    if (!confirm(`Switch to ${interval} billing? Proration will apply.`)) return;
    setSwitchingInterval(true);
    try {
      await payments.changeSubscription(interval);
      const updated = await payments.getSubscription();
      setSub(updated);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to switch plan');
    } finally {
      setSwitchingInterval(false);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const { url } = await payments.getBillingPortal();
      window.location.href = url;
    } catch (e: any) {
      alert(e?.message ?? 'Failed to open billing portal');
      setPortalLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center text-slate-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your TheWileyfox plan</p>
        </div>

        {/* Current status */}
        {sub && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              {isPro ? <Crown className="w-5 h-5 text-amber-400" /> : <Zap className="w-5 h-5 text-brand-400" />}
              <h2 className="text-white font-semibold capitalize">{sub.tier} Plan</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                sub.status === 'active' ? 'bg-green-500/15 text-green-400' :
                sub.status === 'trialing' ? 'bg-blue-500/15 text-blue-400' :
                'bg-red-500/15 text-red-400'
              }`}>{sub.status}</span>
            </div>
            {sub.currentPeriodEnd && (
              <p className="text-slate-500 text-sm">
                {sub.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on{' '}
                {new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            {isPro && isActive && !sub.cancelAtPeriodEnd && (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => switchInterval(isAnnual ? 'monthly' : 'annual')}
                  disabled={switchingInterval}
                  className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  {switchingInterval
                    ? 'Switching…'
                    : isAnnual
                    ? 'Switch to Monthly'
                    : `Switch to Annual (save ${pricing.annualSavePercent}%)`}
                </button>
                <button
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  {portalLoading ? 'Opening…' : 'Manage billing & payment'}
                </button>
                <button
                  onClick={cancel}
                  disabled={cancelling}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  {cancelling ? 'Cancelling…' : 'Cancel subscription'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Plans */}
        {!isPro && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Monthly */}
            <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-white font-bold text-lg">Pro Monthly</p>
                <p className="text-slate-400 text-sm">{pricing.monthlyPriceLabel}</p>
              </div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Unlimited Tags</li>
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> {pricing.tierLimits.premium.maxEmergencyContacts} emergency contacts</li>
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Safety-aware routing</li>
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Priority notifications</li>
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> SOS push to contacts</li>
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Full report history</li>
              </ul>
              <button
                onClick={() => checkout('month')}
                disabled={checkoutLoading !== null}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {checkoutLoading === 'month' ? 'Redirecting…' : `Start ${pricing.trialDays}-day trial`}
              </button>
            </div>

            {/* Annual */}
            <div className="bg-surface-card border border-brand-500/40 rounded-2xl p-5 space-y-4 relative overflow-hidden">
              <div className="absolute top-3 right-3 bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">Save {pricing.annualSavePercent}%</div>
              <div>
                <p className="text-white font-bold text-lg">Pro Annual</p>
                <p className="text-slate-400 text-sm">{pricing.annualPriceLabel}</p>
              </div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Unlimited Tags</li>
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> {pricing.tierLimits.premium.maxEmergencyContacts} emergency contacts</li>
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Safety-aware routing</li>
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Priority notifications</li>
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> SOS push to contacts</li>
                <li className="flex items-start gap-2 text-sm text-slate-300"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Full report history</li>
              </ul>
              <button
                onClick={() => checkout('year')}
                disabled={checkoutLoading !== null}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {checkoutLoading === 'year' ? 'Redirecting…' : `Start ${pricing.trialDays}-day trial`}
              </button>
            </div>
          </div>
        )}

        {/* Free plan features shown when on free */}
        {!isPro && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Current Plan — Free</p>
            <ul className="space-y-2">
              {[
                `${pricing.tierLimits.free.maxQrCodes} Tags`,
                `${pricing.tierLimits.free.maxEmergencyContacts} emergency contacts`,
                'Community map access',
                'Basic safety alerts',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                  <CheckCircle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Invoice history */}
        {invoices.length > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Billing History</h2>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                  <div>
                    <p className="text-white text-sm">{new Date(inv.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <p className="text-slate-500 text-xs capitalize">{inv.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-white text-sm font-medium">
                      {(inv.amount / 100).toFixed(2)} {inv.currency.toUpperCase()}
                    </p>
                    {inv.invoiceUrl && (
                      <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:text-brand-300 underline">
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
