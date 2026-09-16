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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [iceName, setIceName] = useState('');
  const [icePhone, setIcePhone] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [showMedicalOnScan, setShowMedicalOnScan] = useState(false);
  const [requestBroadcast, setRequestBroadcast] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Load QR first — secondary calls must not blank the whole profile page
        const t = await qrCodes.get(id);
        if (cancelled) return;
        setTag(t);
        setName(t.name);
        setLabel(t.label ?? t.name);
        setCategory(t.category);
        setDescription(t.description ?? '');
        setOwnerContactEmail(t.ownerContactEmail ?? '');
        setOwnerContactPhone(t.ownerContactPhone ?? '');
        setRewardMessage(t.rewardMessage ?? '');
        setPhotoUrl(t.photoUrl ?? null);
        const med = (t.customFields?.medicalInfo ?? {}) as Record<string, string>;
        setBloodType(med.bloodType ?? '');
        setAllergies(med.allergies ?? '');
        setMedicalConditions(med.medicalConditions ?? '');
        setMedications(med.medications ?? '');
        setIceName(med.emergencyContactName ?? '');
        setIcePhone(med.emergencyContactPhone ?? '');
        setMedicalNotes(med.notes ?? '');
        setShowMedicalOnScan(Boolean(t.visibilityConfig?.showCustomFields));
        setSelectedThemeId((t as QrCode & { themeId?: string | null }).themeId ?? null);

        const [r, g, vt, pt, tpl] = await Promise.all([
          reports.listForQr(id).catch(() => [] as Report[]),
          guardians.listForQr(id).catch(() => [] as Guardian[]),
          settings.listVisualThemes().catch(() => [] as VisualTheme[]),
          settings.listPrintTemplates().catch(() => [] as PrintTemplate[]),
          settings.getQrTemplate().catch(() => ({ logoUrl: null } as { logoUrl: string | null })),
        ]);
        if (cancelled) return;
        setTagReports(r);
        setTagGuardians(g);
        setThemes(vt);
        setPrintTemplates(pt);
        setLogoUrl(tpl.logoUrl ?? null);
        if (pt.length > 0) setSelectedTemplate(pt[0]);
      } catch {
        if (!cancelled) setTag(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
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
        medicalInfo: {
          bloodType: bloodType || undefined,
          allergies: allergies || undefined,
          medicalConditions: medicalConditions || undefined,
          medications: medications || undefined,
          emergencyContactName: iceName || undefined,
          emergencyContactPhone: icePhone || undefined,
          notes: medicalNotes || undefined,
        },
        visibilityConfig: {
          showName: true,
          showPhoto: true,
          showDescription: true,
          showCustomFields: showMedicalOnScan,
        },
      });
      setTag(updated);
      setPhotoUrl(updated.photoUrl ?? photoUrl);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(file: File | null) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { photoUrl: url } = await qrCodes.uploadPhoto(id, file);
      setPhotoUrl(url);
      setTag((prev) => (prev ? { ...prev, photoUrl: url } : prev));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function toggleLost() {
    if (!tag) return;
    setMarkingLost(true);
    try {
      if (tag.isLost) {
        const updated = await qrCodes.markFound(id);
        setTag(updated);
      } else {
        const updated = await qrCodes.markLost(id);
        setTag(updated);
        try {
          await reports.createMissing({
            qrCodeId: id,
            requestBroadcast: requestBroadcast && (tag.category === 'person' || tag.category === 'medical'),
          });
        } catch {
          // markLost succeeded; missing report is best-effort
        }
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update lost status');
    } finally {
      setMarkingLost(false);
    }
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
    <div className="min-h-screen bg-surface flex items-center justify-center text-[#7a6957]">Loading…</div>
  );
  if (!tag) return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-[#7a6957]">Could not load this QR profile.</p>
      <button
        type="button"
        onClick={() => router.push('/dashboard/qr')}
        className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
      >
        Back to tags
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/qr')} className="text-[#7a6957] hover:text-white transition-colors">
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
            <p className="text-xs text-[#9d8c7a] mt-0.5">
              {tag.isLost
                ? 'Finders will see a red urgent banner when they scan this QR. Guardians were notified.'
                : 'Mark as lost to alert guardians and optionally broadcast a missing-person alert.'}
            </p>
            {!tag.isLost && (tag.category === 'person' || tag.category === 'medical') && (
              <label className="mt-2 flex items-center gap-2 text-xs text-[#7a6957]">
                <input
                  type="checkbox"
                  checked={requestBroadcast}
                  onChange={(e) => setRequestBroadcast(e.target.checked)}
                />
                Request public missing-child broadcast
              </label>
            )}
            {tag.isLost && (
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="tel:999" className="rounded-lg bg-[#D7263D] px-2.5 py-1 text-[11px] font-bold text-white">
                  Call 999
                </a>
                <a href="tel:101" className="rounded-lg border border-surface-border px-2.5 py-1 text-[11px] font-bold text-[#5a4a3d]">
                  Call 101
                </a>
              </div>
            )}
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
            <h2 className="text-sm font-semibold text-[#5a4a3d] uppercase tracking-wider">Finder Page Theme</h2>
            <p className="text-xs text-[#9d8c7a]">Choose how your finder page looks when someone scans this QR.</p>
            <div className="flex flex-wrap gap-3">
              {/* "None / Default" option */}
              <button
                onClick={() => handleSetTheme(null)}
                disabled={settingTheme}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                  selectedThemeId === null
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-surface-border hover:border-brand-500/40'
                }`}
              >
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-surface-border flex items-center justify-center">
                  <span className="text-[#7a6957] text-xs">✕</span>
                </div>
                <span className="text-xs text-[#7a6957]">Default</span>
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
                          : 'border-surface-border hover:border-brand-500/40'
                    }`}
                    title={locked ? `Requires ${theme.tierRequired} tier` : theme.name}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                    <span className="text-xs text-[#7a6957] max-w-[60px] text-center truncate">{theme.name}</span>
                    {locked && (
                      <div className="absolute top-1 right-1">
                        <Lock className="w-3 h-3 text-[#9d8c7a]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {settingTheme && <p className="text-xs text-[#9d8c7a]">Saving theme…</p>}
          </div>
        )}

        {/* Print Tag Section */}
        {printTemplates.length > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#5a4a3d] uppercase tracking-wider">Print Physical Tag</h2>
            <p className="text-xs text-[#9d8c7a]">Select a format then preview and print your QR tag.</p>
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
                          ? 'border-surface-border text-[#7a6957] cursor-not-allowed'
                          : 'border-surface-border text-[#7a6957] hover:border-brand-500/40'
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
          <h2 className="text-sm font-semibold text-[#5a4a3d] uppercase tracking-wider">Tag Details</h2>

          <div className="flex items-center gap-4">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/5 text-xs text-[#7a6957]">
                No photo
              </div>
            )}
            <label className="cursor-pointer rounded-xl border border-surface-border px-3 py-2 text-xs font-semibold text-brand-500">
              {uploadingPhoto ? 'Uploading…' : 'Add / change photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={(e) => void handlePhotoChange(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

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
              <label className="text-xs font-medium text-[#7a6957]">{lbl}</label>
              <input
                type={type}
                value={value}
                onChange={(e) => set(e.target.value)}
                className="w-full bg-surface border border-surface-border text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500"
              />
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-[#9d8c7a] font-mono">{tag.uniqueCode}</p>
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

        {/* Medical / ICE */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#5a4a3d] uppercase tracking-wider">Medical alert info</h2>
          <p className="text-xs text-[#9d8c7a]">
            Stored on this profile for medical / ICE use. Off by default on public scan for children.
          </p>
          <label className="flex items-center gap-2 text-xs text-[#7a6957]">
            <input
              type="checkbox"
              checked={showMedicalOnScan}
              onChange={(e) => setShowMedicalOnScan(e.target.checked)}
            />
            Show medical fields when this QR is scanned
          </label>
          {[
            { label: 'Blood type', value: bloodType, set: setBloodType },
            { label: 'Allergies', value: allergies, set: setAllergies },
            { label: 'Medical conditions', value: medicalConditions, set: setMedicalConditions },
            { label: 'Medications', value: medications, set: setMedications },
            { label: 'ICE contact name', value: iceName, set: setIceName },
            { label: 'ICE contact phone', value: icePhone, set: setIcePhone },
            { label: 'Notes', value: medicalNotes, set: setMedicalNotes },
          ].map(({ label: lbl, value, set }) => (
            <div key={lbl} className="space-y-1.5">
              <label className="text-xs font-medium text-[#7a6957]">{lbl}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="w-full bg-surface border border-surface-border text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save medical info'}
          </button>
        </div>

        {/* Reports */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#5a4a3d] uppercase tracking-wider mb-3">
            Reports ({tagReports.length})
          </h2>
          {tagReports.length === 0 ? (
            <p className="text-[#9d8c7a] text-sm">No reports yet</p>
          ) : (
            <div className="space-y-3">
              {tagReports.map((r) => (
                <div key={r.id} className="border border-surface-border rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-brand-400 font-medium">{r.finderContact}</p>
                    <p className="text-xs text-[#9d8c7a]">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  {r.finderNotes && <p className="text-sm text-[#5a4a3d]">{r.finderNotes}</p>}
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
            <h2 className="text-sm font-semibold text-[#5a4a3d] uppercase tracking-wider">
              Guardians ({tagGuardians.length})
            </h2>
            <a href={`/dashboard/qr/${id}/guardians`} className="text-xs text-brand-400 hover:text-brand-300">Manage →</a>
          </div>
          {tagGuardians.length === 0 ? (
            <p className="text-[#9d8c7a] text-sm">No guardians assigned</p>
          ) : (
            <div className="space-y-2">
              {tagGuardians.map((g) => {
                const person = g.user ?? g.guardian;
                const isActive = g.status === 'active' || g.status === 'approved';
                return (
                <div key={g.id} className="flex items-center justify-between">
                  <p className="text-sm text-white">{person?.firstName} {person?.lastName}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    isActive ? 'bg-green-500/15 text-green-400' :
                    g.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-red-500/15 text-red-400'
                  }`}>{isActive ? 'active' : g.status}</span>
                </div>
                );
              })}
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
