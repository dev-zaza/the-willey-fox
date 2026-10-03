'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Zap, Crown, XCircle, CreditCard, RefreshCw } from 'lucide-react';
import { payments, settings, type SubscriptionStatus, type Invoice, type PricingConfig } from '@/lib/api';
import { isProTier } from '@safetag/shared';

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

type BillingInterval = 'monthly' | 'annual';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function SubscriptionPage() {
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pricing, setPricing] = useState<PricingConfig>(PRICING_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<BillingInterval | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [switchingInterval, setSwitchingInterval] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<'cancel' | 'switch' | null>(null);

  useEffect(() => {
    Promise.all([payments.getSubscription(), payments.getInvoices(), settings.getPricing()])
      .then(([s, i, p]) => { setSub(s); setInvoices(i); setPricing(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function checkout(interval: BillingInterval) {
    setNotice(null);
    setCheckoutLoading(interval);
    try {
      const { url } = await payments.createCheckout(interval);
      window.location.href = url;
    } catch (e: unknown) {
      setNotice({ tone: 'error', text: errorMessage(e, 'Failed to start checkout. Please try again.') });
      setCheckoutLoading(null);
    }
  }

  async function cancel() {
    setNotice(null);
    setPendingAction(null);
    setCancelling(true);
    try {
      await payments.cancelSubscription();
      setSub((prev) => prev ? { ...prev, cancelAtPeriodEnd: true } : prev);
      setNotice({ tone: 'success', text: 'Your subscription will end at the close of the current period.' });
    } catch (e: unknown) {
      setNotice({ tone: 'error', text: errorMessage(e, 'Failed to cancel subscription.') });
    } finally {
      setCancelling(false);
    }
  }

  const isPro = isProTier(sub?.tier) || sub?.tier === 'pro';
  const isActive = sub?.status === 'active' || sub?.status === 'trialing';
  const annualPriceId = pricing.stripePriceIdAnnual || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL;
  const isAnnual = annualPriceId
    ? sub?.subscription?.stripePriceId === annualPriceId
    : false;

  async function switchInterval(interval: BillingInterval) {
    setNotice(null);
    setPendingAction(null);
    setSwitchingInterval(true);
    try {
      await payments.changeSubscription(interval);
      const updated = await payments.getSubscription();
      setSub(updated);
      setNotice({ tone: 'success', text: `Switched to ${interval} billing.` });
    } catch (e: unknown) {
      setNotice({ tone: 'error', text: errorMessage(e, 'Failed to switch plan.') });
    } finally {
      setSwitchingInterval(false);
    }
  }

  async function openBillingPortal() {
    setNotice(null);
    setPortalLoading(true);
    try {
      const { url } = await payments.getBillingPortal();
      window.location.href = url;
    } catch (e: unknown) {
      setNotice({ tone: 'error', text: errorMessage(e, 'Failed to open billing portal.') });
      setPortalLoading(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center text-[#7a6957]">Loading…</div>;

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription</h1>
          <p className="text-[#7a6957] text-sm mt-1">Manage your TheWileyfox plan</p>
        </div>

        {notice && (
          <div
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-xl border px-4 py-3 text-sm ${
              notice.tone === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-green-500/30 bg-green-500/10 text-green-300'
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* Current status */}
        {sub && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              {isPro ? <Crown className="w-5 h-5 text-amber-400" /> : <Zap className="w-5 h-5 text-brand-400" />}
              <h2 className="text-white font-semibold">{isPro ? 'Pro' : 'Free'} Plan</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                sub.status === 'active' ? 'bg-green-500/15 text-green-400' :
                sub.status === 'trialing' ? 'bg-blue-500/15 text-blue-400' :
                'bg-red-500/15 text-red-400'
              }`}>{sub.status}</span>
            </div>
            {sub.currentPeriodEnd && (
              <p className="text-[#9d8c7a] text-sm">
                {sub.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on{' '}
                {new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            {isPro && isActive && !sub.cancelAtPeriodEnd && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => { setNotice(null); setPendingAction('switch'); }}
                    disabled={switchingInterval || pendingAction !== null}
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
                    className="flex items-center gap-1.5 text-[#7a6957] hover:text-[#5a4a3d] text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    {portalLoading ? 'Opening…' : 'Manage billing & payment'}
                  </button>
                  <button
                    onClick={() => { setNotice(null); setPendingAction('cancel'); }}
                    disabled={cancelling || pendingAction !== null}
                    className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    {cancelling ? 'Cancelling…' : 'Cancel subscription'}
                  </button>
                </div>
                {pendingAction === 'switch' && (
                  <div className="rounded-xl border border-surface-border bg-surface px-4 py-3">
                    <p className="text-sm text-[#5a4a3d]">
                      Switch to {isAnnual ? 'monthly' : 'annual'} billing? Proration will apply.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => switchInterval(isAnnual ? 'monthly' : 'annual')}
                        disabled={switchingInterval}
                        className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Switch plan
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingAction(null)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#7a6957]"
                      >
                        Keep current plan
                      </button>
                    </div>
                  </div>
                )}
                {pendingAction === 'cancel' && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                    <p className="text-sm text-red-300">
                      Cancel at the end of the current billing period? You keep Pro until then.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={cancel}
                        disabled={cancelling}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Cancel subscription
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingAction(null)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#7a6957]"
                      >
                        Keep plan
                      </button>
                    </div>
                  </div>
                )}
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
                <p className="text-[#7a6957] text-sm">{pricing.monthlyPriceLabel}</p>
              </div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Unlimited digital tags</li>
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Unlimited family groups</li>
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Travel guide &amp; crime reports</li>
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Bulk QR generation</li>
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Safety-aware routing</li>
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Priority notifications &amp; SOS</li>
              </ul>
              <button
                onClick={() => checkout('monthly')}
                disabled={checkoutLoading !== null}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {checkoutLoading === 'monthly' ? 'Redirecting…' : `Start ${pricing.trialDays}-day trial`}
              </button>
            </div>

            {/* Annual */}
            <div className="bg-surface-card border border-brand-500/40 rounded-2xl p-5 space-y-4 relative overflow-hidden">
              <div className="absolute top-3 right-3 bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">Save {pricing.annualSavePercent}%</div>
              <div>
                <p className="text-white font-bold text-lg">Pro Annual</p>
                <p className="text-[#7a6957] text-sm">{pricing.annualPriceLabel}</p>
              </div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Unlimited digital tags</li>
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Unlimited family groups</li>
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Travel guide &amp; crime reports</li>
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Bulk QR generation</li>
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Safety-aware routing</li>
                <li className="flex items-start gap-2 text-sm text-[#5a4a3d]"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> Priority notifications &amp; SOS</li>
              </ul>
              <button
                onClick={() => checkout('annual')}
                disabled={checkoutLoading !== null}
                className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {checkoutLoading === 'annual' ? 'Redirecting…' : `Start ${pricing.trialDays}-day trial`}
              </button>
            </div>
          </div>
        )}

        {/* Free plan features shown when on free */}
        {!isPro && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-[#7a6957] uppercase tracking-wider mb-3">Your Current Plan — Free</p>
            <ul className="space-y-2">
              {[
                `${pricing.tierLimits.free.maxQrCodes} Tags`,
                `${pricing.tierLimits.free.maxEmergencyContacts} emergency contacts`,
                'Community map access',
                'Basic safety alerts',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[#7a6957]">
                  <CheckCircle className="w-4 h-4 text-[#7a6957] flex-shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Invoice history */}
        {invoices.length > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-[#5a4a3d] uppercase tracking-wider mb-4">Billing History</h2>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                  <div>
                    <p className="text-white text-sm">{new Date(inv.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <p className="text-[#9d8c7a] text-xs capitalize">{inv.status}</p>
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
