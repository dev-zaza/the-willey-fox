'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, AlertTriangle, CheckCircle, Lock, Printer } from 'lucide-react';
import {
  qrCodes, reports, guardians, settings,
  type QrCode, type Report, type Guardian, type VisualTheme, type PrintTemplate,
} from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { PrintPreviewModal } from '@/components/print-preview-modal';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1')
  .replace(/\/api\/v\d+\/?$/, '');

const TIER_ORDER = ['free', 'basic', 'premium', 'enterprise'];

function tierIndex(t: string) {
  return TIER_ORDER.indexOf(t);
}

export default function QrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [tag, setTag] = useState<QrCode | null>(null);
  const [tagReports, setTagReports] = useState<Report[]>([]);
  const [tagGuardians, setTagGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markingLost, setMarkingLost] = useState(false);

  // Theme state
  const [themes, setThemes] = useState<VisualTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [settingTheme, setSettingTheme] = useState(false);

  // Print state
  const [printTemplates, setPrintTemplates] = useState<PrintTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplate | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [ownerContactEmail, setOwnerContactEmail] = useState('');
  const [ownerContactPhone, setOwnerContactPhone] = useState('');
  const [rewardMessage, setRewardMessage] = useState('');

  useEffect(() => {
    Promise.all([
      qrCodes.get(id),
      reports.listForQr(id),
      guardians.listForQr(id),
      settings.listVisualThemes(),
      settings.listPrintTemplates(),
      settings.getQrTemplate(),
    ])
      .then(([t, r, g, vt, pt, tpl]) => {
        setTag(t);
        setName(t.name);
        setLabel(t.label ?? t.name);
        setCategory(t.category);
        setDescription(t.description ?? '');
        setOwnerContactEmail(t.ownerContactEmail ?? '');
        setOwnerContactPhone(t.ownerContactPhone ?? '');
        setRewardMessage(t.rewardMessage ?? '');
        setTagReports(r);
        setTagGuardians(g);
        setThemes(vt);
        setPrintTemplates(pt);
        setLogoUrl(tpl.logoUrl ?? null);
        setSelectedThemeId((t as QrCode & { themeId?: string | null }).themeId ?? null);
        if (pt.length > 0) setSelectedTemplate(pt[0]);
      })
      .catch(() => router.push('/dashboard/qr'))
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    setSaving(true);
    try {
      const updated = await qrCodes.update(id, {
        name,
        label: label || undefined,
        category,
        description: description || undefined,
        ownerContactEmail: ownerContactEmail || undefined,
        ownerContactPhone: ownerContactPhone || undefined,
        rewardMessage: rewardMessage || undefined,
      });
      setTag(updated);
    } catch {}
    finally { setSaving(false); }
  }

  async function toggleLost() {
    if (!tag) return;
    setMarkingLost(true);
    try {
      const updated = tag.isLost
        ? await qrCodes.markFound(id)
        : await qrCodes.markLost(id);
      setTag(updated);
    } catch {}
    finally { setMarkingLost(false); }
  }

  async function handleSetTheme(themeId: string | null) {
    if (settingTheme) return;
    setSettingTheme(true);
    try {
      const updated = await qrCodes.setTheme(id, themeId);
      setTag(updated);
      setSelectedThemeId(themeId);
    } catch {}
    finally { setSettingTheme(false); }
  }

  const userTier = user?.subscriptionTier ?? 'free';

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center text-slate-400">Loading…</div>
  );
  if (!tag) return null;

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/qr')} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white flex-1">{tag.label ?? tag.name}</h1>
          {tag.isLost && (
            <span className="flex items-center gap-1 bg-red-500/15 text-red-400 text-xs font-medium px-2 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" /> Lost
            </span>
          )}
        </div>

        {/* Lost/Found toggle */}
        <div className={`flex items-center justify-between rounded-2xl p-4 border ${
          tag.isLost
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-green-500/10 border-green-500/30'
        }`}>
          <div>
            <p className={`text-sm font-semibold ${tag.isLost ? 'text-red-400' : 'text-green-400'}`}>
              {tag.isLost ? 'Reported as Lost' : 'Status: Safe'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {tag.isLost
                ? 'Finders will see a red urgent banner when they scan this QR.'
                : 'Mark as lost to alert finders when this QR is scanned.'}
            </p>
          </div>
          <button
            onClick={toggleLost}
            disabled={markingLost}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ${
              tag.isLost
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {markingLost ? '…' : tag.isLost ? (
              <><CheckCircle className="w-4 h-4" /> Mark Found</>
            ) : (
              <><AlertTriangle className="w-4 h-4" /> Mark Lost</>
            )}
          </button>
        </div>

        {/* Visual Theme Picker */}
        {themes.length > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Finder Page Theme</h2>
            <p className="text-xs text-slate-500">Choose how your finder page looks when someone scans this QR.</p>
            <div className="flex flex-wrap gap-3">
              {/* "None / Default" option */}
              <button
                onClick={() => handleSetTheme(null)}
                disabled={settingTheme}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                  selectedThemeId === null
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-surface-border hover:border-slate-500'
                }`}
              >
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-500 flex items-center justify-center">
                  <span className="text-slate-400 text-xs">✕</span>
                </div>
                <span className="text-xs text-slate-400">Default</span>
              </button>

              {themes.map((theme) => {
                const locked = tierIndex(userTier) < tierIndex(theme.tierRequired);
                const isSelected = selectedThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => !locked && handleSetTheme(theme.id)}
                    disabled={locked || settingTheme}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10'
                        : locked
                          ? 'border-surface-border opacity-50 cursor-not-allowed'
                          : 'border-surface-border hover:border-slate-500'
                    }`}
                    title={locked ? `Requires ${theme.tierRequired} tier` : theme.name}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                    <span className="text-xs text-slate-400 max-w-[60px] text-center truncate">{theme.name}</span>
                    {locked && (
                      <div className="absolute top-1 right-1">
                        <Lock className="w-3 h-3 text-slate-500" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {settingTheme && <p className="text-xs text-slate-500">Saving theme…</p>}
          </div>
        )}

        {/* Print Tag Section */}
        {printTemplates.length > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Print Physical Tag</h2>
            <p className="text-xs text-slate-500">Select a format then preview and print your QR tag.</p>
            <div className="flex flex-wrap gap-2">
              {printTemplates.map((pt) => {
                const locked = tierIndex(userTier) < tierIndex(pt.tierRequired);
                return (
                  <button
                    key={pt.id}
                    onClick={() => !locked && setSelectedTemplate(pt)}
                    disabled={locked}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      selectedTemplate?.id === pt.id
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : locked
                          ? 'border-surface-border text-slate-600 cursor-not-allowed'
                          : 'border-surface-border text-slate-400 hover:border-slate-500'
                    }`}
                    title={locked ? `Requires ${pt.tierRequired} tier` : pt.name}
                  >
                    {locked && <Lock className="w-3 h-3" />}
                    <span className="capitalize">{pt.formatType}</span>
                    <span className="text-xs opacity-70">({pt.name})</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowPrintModal(true)}
              disabled={!selectedTemplate}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Printer className="w-4 h-4" />
              Preview &amp; Print
            </button>
          </div>
        )}

        {/* Edit form */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Tag Details</h2>

          {[
            { label: 'Name (shown on finder page)', value: name, set: setName, type: 'text' },
            { label: 'Display Label (optional shortname)', value: label, set: setLabel, type: 'text' },
            { label: 'Category', value: category, set: setCategory, type: 'text' },
            { label: 'Description', value: description, set: setDescription, type: 'text' },
            { label: 'Owner Contact Email (shown to finders)', value: ownerContactEmail, set: setOwnerContactEmail, type: 'email' },
            { label: 'Owner Contact Phone (shown to finders)', value: ownerContactPhone, set: setOwnerContactPhone, type: 'tel' },
            { label: 'Reward Message (shown to finders)', value: rewardMessage, set: setRewardMessage, type: 'text' },
          ].map(({ label: lbl, value, set, type }) => (
            <div key={lbl} className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">{lbl}</label>
              <input
                type={type}
                value={value}
                onChange={(e) => set(e.target.value)}
                className="w-full bg-surface border border-surface-border text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500"
              />
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500 font-mono">{tag.uniqueCode}</p>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Reports */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Reports ({tagReports.length})
          </h2>
          {tagReports.length === 0 ? (
            <p className="text-slate-500 text-sm">No reports yet</p>
          ) : (
            <div className="space-y-3">
              {tagReports.map((r) => (
                <div key={r.id} className="border border-surface-border rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-brand-400 font-medium">{r.finderContact}</p>
                    <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  {r.finderNotes && <p className="text-sm text-slate-300">{r.finderNotes}</p>}
                  {r.locationLat && r.locationLng && (
                    <a
                      href={`https://maps.google.com/?q=${r.locationLat},${r.locationLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 underline"
                    >
                      View on map
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Guardians */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Guardians ({tagGuardians.length})
            </h2>
            <a href={`/dashboard/qr/${id}/guardians`} className="text-xs text-brand-400 hover:text-brand-300">Manage →</a>
          </div>
          {tagGuardians.length === 0 ? (
            <p className="text-slate-500 text-sm">No guardians assigned</p>
          ) : (
            <div className="space-y-2">
              {tagGuardians.map((g) => (
                <div key={g.id} className="flex items-center justify-between">
                  <p className="text-sm text-white">{g.guardian.firstName} {g.guardian.lastName}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    g.status === 'approved' ? 'bg-green-500/15 text-green-400' :
                    g.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-red-500/15 text-red-400'
                  }`}>{g.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Print Preview Modal */}
      {showPrintModal && selectedTemplate && tag && (
        <PrintPreviewModal
          template={selectedTemplate}
          qrCode={tag}
          apiBase={API_BASE}
          logoUrl={logoUrl}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
