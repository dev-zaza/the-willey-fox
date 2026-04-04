'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { admin, type PricingConfig } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';

const TIER_KEYS: Array<keyof PricingConfig['tierLimits']> = ['free', 'basic', 'premium'];
const LIMIT_FIELDS: Array<{ key: keyof PricingConfig['tierLimits']['free']; label: string }> = [
  { key: 'maxQrCodes', label: 'Max QR Tags' },
  { key: 'maxGuardians', label: 'Max Guardians' },
  { key: 'maxEmergencyContacts', label: 'Max Emergency Contacts' },
  { key: 'maxPinsPerDay', label: 'Max Pins / Day' },
];

const inputCls = 'w-full rounded-lg border admin-border-color admin-surface-raised px-3 py-2 text-sm admin-text-color placeholder:admin-text-subtle focus:outline-none admin-accent-ring transition-colors';
const labelCls = 'block text-xs admin-text-subtle mb-1.5';

export default function PricingPage() {
  const [form, setForm] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    admin.getPricing().then(setForm).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
      </div>
    );
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await admin.updatePricing(form);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof PricingConfig>(key: K, value: PricingConfig[K]) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  function setTierField(tier: keyof PricingConfig['tierLimits'], field: keyof PricingConfig['tierLimits']['free'], value: number) {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, tierLimits: { ...prev.tierLimits, [tier]: { ...prev.tierLimits[tier], [field]: value } } };
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <AdminPageHeader
        title="Pricing"
        description="Configure subscription pricing and tier limits"
        actions={
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg admin-accent-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        }
      />

      <div className="rounded-xl border admin-border-color admin-surface p-5 space-y-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider admin-text-subtle">Stripe & Display</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Monthly Price (cents)</label>
            <input type="number" min="0" className={inputCls} value={form.monthlyPriceCents} onChange={(e) => setField('monthlyPriceCents', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Monthly Price Label</label>
            <input type="text" className={inputCls} value={form.monthlyPriceLabel} onChange={(e) => setField('monthlyPriceLabel', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Annual Price (cents)</label>
            <input type="number" min="0" className={inputCls} value={form.annualPriceCents} onChange={(e) => setField('annualPriceCents', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Annual Price Label</label>
            <input type="text" className={inputCls} value={form.annualPriceLabel} onChange={(e) => setField('annualPriceLabel', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Annual Save % (badge)</label>
            <input type="number" min="0" max="100" className={inputCls} value={form.annualSavePercent} onChange={(e) => setField('annualSavePercent', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Trial Days</label>
            <input type="number" min="0" className={inputCls} value={form.trialDays} onChange={(e) => setField('trialDays', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Stripe Price ID — Monthly</label>
            <input type="text" className={inputCls} value={form.stripePriceIdMonthly} placeholder="price_…" onChange={(e) => setField('stripePriceIdMonthly', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Stripe Price ID — Annual</label>
            <input type="text" className={inputCls} value={form.stripePriceIdAnnual} placeholder="price_…" onChange={(e) => setField('stripePriceIdAnnual', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border admin-border-color admin-surface p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider admin-text-subtle">Tier Limits</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b admin-border-color">
                <th className="text-left py-2 pr-6 text-xs admin-text-subtle font-medium">Tier</th>
                {LIMIT_FIELDS.map((f) => (
                  <th key={f.key} className="text-left py-2 px-2 text-xs admin-text-subtle font-medium whitespace-nowrap">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y admin-border-color">
              {TIER_KEYS.map((tier) => (
                <tr key={tier}>
                  <td className="py-3 pr-6 text-sm font-medium admin-text-color capitalize">{tier}</td>
                  {LIMIT_FIELDS.map((f) => (
                    <td key={f.key} className="py-3 px-2">
                      <input
                        type="number"
                        min="0"
                        className="w-24 rounded-lg border admin-border-color admin-surface-raised px-2 py-1.5 text-sm admin-text-color focus:outline-none admin-accent-ring"
                        value={form.tierLimits[tier][f.key]}
                        onChange={(e) => setTierField(tier, f.key, Number(e.target.value))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
