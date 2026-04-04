'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, Printer } from 'lucide-react';
import { admin, type PrintTemplate, type CreatePrintTemplatePayload } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { cn } from '@/lib/utils';

const FORMAT_LABELS: Record<string, string> = {
  square: 'Square',
  rectangle: 'Rectangle',
  wristband: 'Wristband',
};

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  basic: 'Basic',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

const emptyForm: CreatePrintTemplatePayload = {
  name: '',
  formatType: 'square',
  tierRequired: 'free',
  backgroundColor: '#ffffff',
  logoPlacement: 'top-left',
  logoSize: 40,
  qrPosition: 'center',
  qrSize: 120,
  textSlots: {
    showTagName: true,
    showInstructions: true,
    instructionsText: 'Scan to help return this item',
    showReward: true,
    tagNamePosition: 'bottom',
    instructionsPosition: 'bottom',
  },
  isActive: true,
};

export default function PrintTemplatesPage() {
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PrintTemplate | null>(null);
  const [form, setForm] = useState<CreatePrintTemplatePayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    admin.listPrintTemplates()
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(t: PrintTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      formatType: t.formatType,
      tierRequired: t.tierRequired,
      backgroundColor: t.backgroundColor,
      logoPlacement: t.logoPlacement,
      logoSize: t.logoSize,
      qrPosition: t.qrPosition,
      qrSize: t.qrSize,
      textSlots: t.textSlots ?? {},
      isActive: t.isActive,
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        const updated = await admin.updatePrintTemplate(editing.id, form);
        setTemplates((prev) => prev.map((t) => (t.id === editing.id ? updated : t)));
      } else {
        const created = await admin.createPrintTemplate(form);
        setTemplates((prev) => [created, ...prev]);
      }
      setShowModal(false);
    } catch {}
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this print template?')) return;
    setDeleting(id);
    try {
      await admin.deletePrintTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {}
    finally { setDeleting(null); }
  }

  // Live print preview (CSS-only layout)
  function PrintPreview() {
    const dim = form.formatType === 'wristband'
      ? { width: 240, height: 80 }
      : form.formatType === 'rectangle'
        ? { width: 180, height: 100 }
        : { width: 120, height: 120 };

    return (
      <div
        className="relative border border-gray-200 overflow-hidden mx-auto flex flex-col items-center justify-center text-center"
        style={{ width: dim.width, height: dim.height, backgroundColor: form.backgroundColor, borderRadius: 8, fontSize: 9, gap: 4 }}
      >
        {form.logoPlacement !== 'none' && (
          <div className="text-gray-400" style={{ fontSize: 7, fontWeight: 600, position: 'absolute', top: 4, left: form.logoPlacement === 'top-right' ? undefined : 6, right: form.logoPlacement === 'top-right' ? 6 : undefined }}>
            LOGO
          </div>
        )}
        <div style={{ width: form.qrSize * 0.4, height: form.qrSize * 0.4, border: '1px solid #ddd', borderRadius: 4, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#999' }}>
          QR
        </div>
        {(form.textSlots as Record<string, unknown>)?.showTagName && (
          <div className="font-semibold truncate" style={{ color: '#333', maxWidth: dim.width - 12 }}>Tag Name</div>
        )}
        {(form.textSlots as Record<string, unknown>)?.showInstructions && (
          <div style={{ color: '#666', fontSize: 7 }}>{String((form.textSlots as Record<string, unknown>)?.instructionsText ?? '')}</div>
        )}
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
        title="Print Templates"
        description="Manage physical tag layouts for printing. Users select a template when printing their QR tag."
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Template
          </button>
        }
      />

      <div className="rounded-xl border admin-border-color overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b admin-border-color admin-surface">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider admin-text-subtle">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider admin-text-subtle">Format</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider admin-text-subtle">Tier</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider admin-text-subtle">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 admin-text-subtle text-sm">
                  No print templates yet.
                </td>
              </tr>
            )}
            {templates.map((t) => (
              <tr key={t.id} className="border-b admin-border-color last:border-b-0 hover:admin-surface-hover transition-colors">
                <td className="px-4 py-3 admin-text-color font-medium flex items-center gap-2">
                  <Printer className="h-4 w-4 admin-text-subtle shrink-0" />
                  {t.name}
                </td>
                <td className="px-4 py-3 admin-text-muted">{FORMAT_LABELS[t.formatType] ?? t.formatType}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    t.tierRequired === 'free' ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'
                  )}>
                    {TIER_LABELS[t.tierRequired] ?? t.tierRequired}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', t.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>
                    {t.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="admin-surface rounded-2xl border admin-border-color shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b admin-border-color">
              <h2 className="text-base font-semibold admin-text-color">
                {editing ? 'Edit Print Template' : 'New Print Template'}
              </h2>
              <button onClick={() => setShowModal(false)} className="admin-text-subtle hover:admin-text-muted text-lg leading-none">×</button>
            </div>

            <div className="flex flex-1 overflow-hidden divide-x admin-border-color">
              {/* Form */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium admin-text-subtle">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium admin-text-subtle">Format</label>
                    <select
                      value={form.formatType}
                      onChange={(e) => setForm((f) => ({ ...f, formatType: e.target.value }))}
                      className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none"
                    >
                      <option value="square">Square</option>
                      <option value="rectangle">Rectangle</option>
                      <option value="wristband">Wristband</option>
                    </select>
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium admin-text-subtle">Background Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.backgroundColor} onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))} className="h-8 w-10 rounded border admin-border-color cursor-pointer" />
                      <span className="text-xs admin-text-muted font-mono">{form.backgroundColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium admin-text-subtle">Logo Placement</label>
                    <select
                      value={form.logoPlacement}
                      onChange={(e) => setForm((f) => ({ ...f, logoPlacement: e.target.value }))}
                      className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none"
                    >
                      <option value="top-left">Top Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="center">Center</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium admin-text-subtle">QR Position</label>
                    <select
                      value={form.qrPosition}
                      onChange={(e) => setForm((f) => ({ ...f, qrPosition: e.target.value }))}
                      className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none"
                    >
                      <option value="top">Top</option>
                      <option value="center">Center</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium admin-text-subtle">QR Size (px)</label>
                    <input
                      type="number"
                      min={60}
                      max={400}
                      value={form.qrSize}
                      onChange={(e) => setForm((f) => ({ ...f, qrSize: Number(e.target.value) }))}
                      className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium admin-text-subtle">Text Slots</label>
                  {[
                    { key: 'showTagName', label: 'Show Tag Name' },
                    { key: 'showInstructions', label: 'Show Instructions' },
                    { key: 'showReward', label: 'Show Reward' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean((form.textSlots as Record<string, unknown>)?.[key])}
                        onChange={(e) => setForm((f) => ({ ...f, textSlots: { ...(f.textSlots as object), [key]: e.target.checked } }))}
                        className="rounded"
                      />
                      <span className="text-sm admin-text-muted">{label}</span>
                    </label>
                  ))}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium admin-text-subtle">Instructions Text</label>
                    <input
                      type="text"
                      value={String((form.textSlots as Record<string, unknown>)?.instructionsText ?? '')}
                      onChange={(e) => setForm((f) => ({ ...f, textSlots: { ...(f.textSlots as object), instructionsText: e.target.value } }))}
                      className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm admin-text-muted">Active</span>
                </label>
              </div>

              {/* Live Preview */}
              <div className="w-56 flex flex-col items-center justify-center p-6 gap-4">
                <p className="text-xs font-semibold uppercase tracking-wider admin-text-subtle">Preview</p>
                <PrintPreview />
                <p className="text-xs admin-text-subtle text-center">{FORMAT_LABELS[form.formatType]} format</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t admin-border-color">
              <button onClick={() => setShowModal(false)} className="text-sm admin-text-muted admin-hover px-3 py-1.5 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
