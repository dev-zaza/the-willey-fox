'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle } from 'lucide-react';
import { admin, type QrTemplateConfig } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';

const inputCls =
  'w-full rounded-lg border admin-border-color admin-surface-raised px-3 py-2 text-sm admin-text-color placeholder:admin-text-subtle focus:outline-none admin-accent-ring transition-colors';
const labelCls = 'block text-xs admin-text-subtle mb-1.5';

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-brand-500' : 'admin-surface-raised border admin-border-color'}`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
        />
      </div>
      <span className="text-sm admin-text-color">{label}</span>
    </label>
  );
}

export default function QrTemplatePage() {
  const [form, setForm] = useState<QrTemplateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    admin.getQrTemplate().then(setForm).catch(console.error).finally(() => setLoading(false));
  }, []);

  function patch(key: keyof QrTemplateConfig, value: unknown) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await admin.updateQrTemplate(form);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin admin-text-subtle" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <AdminPageHeader
        title="QR Tag Display Template"
        description="Configure how QR tag cards appear to finders when they scan a tag."
      />

      {/* Display toggles */}
      <div className="admin-surface-card rounded-xl border admin-border-color p-5 space-y-4">
        <h2 className="text-sm font-semibold admin-text-color">Display Options</h2>
        <Toggle label="Show brand logo on tag card" checked={form.showLogo} onChange={(v) => patch('showLogo', v)} />
        <Toggle label="Show item category badge" checked={form.showCategory} onChange={(v) => patch('showCategory', v)} />
        <Toggle label="Show reward message" checked={form.showReward} onChange={(v) => patch('showReward', v)} />
        <Toggle label="Show owner contact details" checked={form.showOwnerContact} onChange={(v) => patch('showOwnerContact', v)} />
      </div>

      {/* Appearance */}
      <div className="admin-surface-card rounded-xl border admin-border-color p-5 space-y-4">
        <h2 className="text-sm font-semibold admin-text-color">Appearance</h2>

        <div>
          <label className={labelCls}>Accent Colour</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.accentColor}
              onChange={(e) => patch('accentColor', e.target.value)}
              className="h-9 w-14 rounded cursor-pointer border admin-border-color bg-transparent"
            />
            <input
              type="text"
              value={form.accentColor}
              onChange={(e) => patch('accentColor', e.target.value)}
              className={`${inputCls} flex-1`}
              placeholder="#ea2e00"
              maxLength={7}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Footer Text</label>
          <input
            type="text"
            value={form.footerText}
            onChange={(e) => patch('footerText', e.target.value)}
            className={inputCls}
            placeholder="Scan to help return this item"
            maxLength={120}
          />
        </div>

        <div>
          <label className={labelCls}>Custom Logo URL (optional)</label>
          <input
            type="url"
            value={form.logoUrl ?? ''}
            onChange={(e) => patch('logoUrl', e.target.value || null)}
            className={inputCls}
            placeholder="https://… (leave blank to use default logo)"
          />
        </div>
      </div>

      {/* Live preview */}
      <div className="admin-surface-card rounded-xl border admin-border-color p-5 space-y-3">
        <h2 className="text-sm font-semibold admin-text-color">Preview</h2>
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{ borderColor: form.accentColor + '55', background: form.accentColor + '0a' }}
        >
          {form.showLogo && (
            <div className="flex items-center gap-2">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="logo" className="h-6 w-auto rounded" />
              ) : (
                <div
                  className="text-white text-xs font-bold px-2 py-1 rounded"
                  style={{ backgroundColor: form.accentColor }}
                >
                  TheWileyfox
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: form.accentColor + '22', border: `1px solid ${form.accentColor}` }}
            >
              🐾
            </div>
            <div>
              {form.showCategory && (
                <p className="text-xs font-bold uppercase mb-0.5" style={{ color: form.accentColor }}>
                  Pet / Animal
                </p>
              )}
              <p className="text-sm font-semibold admin-text-color">Buddy the Dog</p>
            </div>
          </div>
          {form.showReward && (
            <p className="text-xs font-semibold" style={{ color: '#22c55e' }}>🎁 $100 reward if returned</p>
          )}
          {form.showOwnerContact && (
            <p className="text-xs admin-text-subtle">📧 owner@example.com</p>
          )}
          <p className="text-xs admin-text-subtle border-t admin-border-color pt-2 mt-1">{form.footerText}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: form.accentColor }}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Saved!' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}
