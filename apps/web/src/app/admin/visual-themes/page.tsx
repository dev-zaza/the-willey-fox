'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { admin, type VisualTheme, type CreateVisualThemePayload } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { cn } from '@/lib/utils';

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  basic: 'Basic',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

const emptyForm: CreateVisualThemePayload = {
  name: '',
  accentColor: '#ea2e00',
  backgroundStyle: 'light',
  showLogo: true,
  logoUrl: '',
  tierRequired: 'free',
  isActive: true,
};

export default function VisualThemesPage() {
  const [themes, setThemes] = useState<VisualTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<VisualTheme | null>(null);
  const [form, setForm] = useState<CreateVisualThemePayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    admin.listVisualThemes()
      .then(setThemes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(t: VisualTheme) {
    setEditing(t);
    setForm({
      name: t.name,
      accentColor: t.accentColor,
      backgroundStyle: t.backgroundStyle,
      showLogo: t.showLogo,
      logoUrl: t.logoUrl ?? '',
      tierRequired: t.tierRequired,
      isActive: t.isActive,
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...form, logoUrl: form.logoUrl || undefined };
      if (editing) {
        const updated = await admin.updateVisualTheme(editing.id, payload);
        setThemes((prev) => prev.map((t) => (t.id === editing.id ? updated : t)));
      } else {
        const created = await admin.createVisualTheme(payload);
        setThemes((prev) => [created, ...prev]);
      }
      setShowModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this visual theme? QR codes using it will revert to the default appearance.')) return;
    setDeleting(id);
    try {
      await admin.deleteVisualTheme(id);
      setThemes((prev) => prev.filter((t) => t.id !== id));
    } catch {}
    finally { setDeleting(null); }
  }

  // Live theme card preview
  function ThemePreview() {
    const isDark = form.backgroundStyle === 'dark';
    return (
      <div
        className="rounded-xl overflow-hidden border shadow-md mx-auto"
        style={{
          width: 140,
          backgroundColor: isDark ? '#1a1a2e' : '#fff',
          borderColor: form.accentColor + '44',
        }}
      >
        <div className="px-3 py-2 flex items-center gap-1.5" style={{ backgroundColor: form.accentColor }}>
          {form.showLogo && <div className="text-white text-[9px] font-bold">LOGO</div>}
        </div>
        <div className="p-3 flex flex-col items-center gap-2">
          <div className="w-12 h-12 border rounded flex items-center justify-center text-[8px]" style={{ borderColor: form.accentColor, color: isDark ? '#fff' : '#333', backgroundColor: isDark ? '#16213e' : '#f9f9f9' }}>
            QR
          </div>
          <div className="text-center text-[9px] font-semibold" style={{ color: isDark ? '#fff' : '#111' }}>Tag Name</div>
          <div style={{ height: 2, width: 24, borderRadius: 1, backgroundColor: form.accentColor }} />
          <div className="text-[8px]" style={{ color: isDark ? '#aaa' : '#666' }}>Scan to return</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin admin-text-subtle" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <AdminPageHeader
        title="Visual Themes"
        description="Manage the appearance of QR finder pages. Users select a theme per tag (tier-gated)."
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Theme
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {themes.length === 0 && (
          <div className="col-span-3 text-center py-10 admin-text-subtle text-sm">
            No visual themes yet.
          </div>
        )}
        {themes.map((t) => (
          <div key={t.id} className="rounded-xl border admin-border-color admin-surface overflow-hidden">
            {/* Color bar */}
            <div className="h-2" style={{ backgroundColor: t.accentColor }} />
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold admin-text-color">{t.name}</p>
                  <p className="text-xs admin-text-subtle capitalize">{t.backgroundStyle} background</p>
                </div>
                <div className="w-6 h-6 rounded-full border-2 border-white shadow shrink-0" style={{ backgroundColor: t.accentColor }} />
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  t.tierRequired === 'free' ? 'bg-green-500/10 text-green-400' : 'bg-brand-500/10 text-brand-400'
                )}>
                  {TIER_LABELS[t.tierRequired] ?? t.tierRequired}
                </span>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', t.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>
                  {t.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg admin-text-muted admin-hover transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {deleting === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="admin-surface rounded-2xl border admin-border-color shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b admin-border-color">
              <h2 className="text-base font-semibold admin-text-color">
                {editing ? 'Edit Visual Theme' : 'New Visual Theme'}
              </h2>
              <button onClick={() => setShowModal(false)} className="admin-text-subtle hover:admin-text-muted text-lg leading-none">×</button>
            </div>

            <div className="flex flex-1 overflow-hidden divide-x admin-border-color">
              {/* Form */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium admin-text-subtle">Theme Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none focus:border-brand-500"
                    placeholder="e.g. Midnight Dark"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium admin-text-subtle">Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.accentColor} onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))} className="h-8 w-10 rounded border admin-border-color cursor-pointer" />
                      <span className="text-xs admin-text-muted font-mono">{form.accentColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium admin-text-subtle">Background Style</label>
                    <select
                      value={form.backgroundStyle}
                      onChange={(e) => setForm((f) => ({ ...f, backgroundStyle: e.target.value }))}
                      className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium admin-text-subtle">Tier Required</label>
                  <select
                    value={form.tierRequired}
                    onChange={(e) => setForm((f) => ({ ...f, tierRequired: e.target.value }))}
                    className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium admin-text-subtle">Logo URL (optional)</label>
                  <input
                    type="url"
                    value={form.logoUrl ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                    className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none"
                    placeholder="https://..."
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.showLogo}
                      onChange={(e) => setForm((f) => ({ ...f, showLogo: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm admin-text-muted">Show Logo on Finder Page</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm admin-text-muted">Active (visible to users)</span>
                  </label>
                </div>
              </div>

              {/* Live Preview */}
              <div className="w-52 flex flex-col items-center justify-center p-6 gap-4">
                <p className="text-xs font-semibold uppercase tracking-wider admin-text-subtle">Preview</p>
                <ThemePreview />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t admin-border-color">
              <button onClick={() => setShowModal(false)} className="text-sm admin-text-muted admin-hover px-3 py-1.5 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Theme'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
