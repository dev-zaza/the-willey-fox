'use client';

import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { admin, type QrCategoryConfig } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { cn } from '@/lib/utils';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<QrCategoryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<Record<string, string>>({});

  useEffect(() => {
    admin.getQrCategories()
      .then((cats) => {
        setCategories(cats);
        const labels: Record<string, string> = {};
        cats.forEach((c) => { labels[c.value] = c.label; });
        setEditLabel(labels);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(cat: QrCategoryConfig) {
    if (cat.core && cat.enabled) return;
    setSaving(cat.value);
    try {
      const updated = await admin.updateQrCategory(cat.value, { enabled: !cat.enabled });
      setCategories(updated);
    } catch {}
    finally { setSaving(null); }
  }

  async function handleLabelSave(cat: QrCategoryConfig) {
    const newLabel = editLabel[cat.value]?.trim();
    if (!newLabel || newLabel === cat.label) return;
    setSaving(cat.value + '_label');
    try {
      const updated = await admin.updateQrCategory(cat.value, { label: newLabel });
      setCategories(updated);
    } catch {}
    finally { setSaving(null); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin admin-text-subtle" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <AdminPageHeader
        title="QR Categories"
        description="Enable or disable tag categories available to users. Core categories cannot be disabled."
      />

      <div className="rounded-xl border admin-border-color admin-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b admin-border-color admin-surface-raised">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider admin-text-subtle">Value</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider admin-text-subtle">Display Label</th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider admin-text-subtle">Core</th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider admin-text-subtle">Enabled</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider admin-text-subtle">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y admin-border-color">
            {categories.map((cat) => (
              <tr key={cat.value} className="admin-hover transition-colors">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs admin-text-muted">{cat.value}</span>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={editLabel[cat.value] ?? cat.label}
                    onChange={(e) => setEditLabel((prev) => ({ ...prev, [cat.value]: e.target.value }))}
                    className="w-36 rounded-lg border admin-border-color admin-surface-raised px-2 py-1 text-sm admin-text-color focus:outline-none admin-accent-ring transition-colors"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  {cat.core ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                      <Lock className="h-3 w-3" /> Core
                    </span>
                  ) : (
                    <span className="text-zinc-700">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleToggle(cat)}
                      disabled={!!saving || (cat.core && cat.enabled)}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        cat.enabled ? 'admin-accent-bg' : 'bg-zinc-700',
                        cat.core && cat.enabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                          cat.enabled ? 'translate-x-4' : 'translate-x-0.5',
                        )}
                      />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleLabelSave(cat)}
                    disabled={saving === cat.value + '_label' || editLabel[cat.value] === cat.label}
                    className="inline-flex items-center gap-1.5 rounded-lg border admin-border-color admin-surface-raised px-3 py-1 text-xs admin-text-muted admin-hover disabled:opacity-30 transition-colors"
                  >
                    {saving === cat.value + '_label' ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />Saving</>
                    ) : 'Save'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
