'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, Plus, ShoppingBag, X } from 'lucide-react';
import { publicQr, qrCodes, type QrCode } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { getShopifyShopUrl } from '@/lib/shopify-shop';
import { cn } from '@/lib/utils';

const QR_CATEGORIES = ['pet', 'bag', 'key', 'person', 'vehicle', 'other', 'medical', 'place'] as const;

const ICE_FIELDS = [
  { key: 'name', label: 'Name and age', hint: 'Shown as the tag name' },
  { key: 'contacts', label: 'Emergency contacts', hint: 'Relayed — numbers never shown' },
  { key: 'allergies', label: 'Allergies', hint: 'From the guardian note / description' },
  { key: 'conditions', label: 'Conditions', hint: 'Optional' },
  { key: 'medication', label: 'Medication', hint: 'Optional' },
  { key: 'note', label: 'Guardian note', hint: 'Reward / finder message' },
] as const;

type IceKey = (typeof ICE_FIELDS)[number]['key'];

function loadIce(tagId: string): Record<IceKey, boolean> {
  try {
    const raw = localStorage.getItem(`wf_ice_${tagId}`);
    if (raw) return JSON.parse(raw) as Record<IceKey, boolean>;
  } catch {
    /* ignore */
  }
  return { name: true, contacts: true, allergies: false, conditions: false, medication: false, note: true };
}

export default function QrPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tags, setTags] = useState<QrCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkCount, setBulkCount] = useState(3);
  const [bulkCategory, setBulkCategory] = useState('other');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [iceTagId, setIceTagId] = useState<string | null>(null);
  const [iceOn, setIceOn] = useState<Record<IceKey, boolean>>({
    name: true,
    contacts: true,
    allergies: false,
    conditions: false,
    medication: false,
    note: true,
  });
  const [linkOpen, setLinkOpen] = useState(false);

  const isPremium = user?.subscriptionTier === 'premium' || user?.subscriptionTier === 'enterprise';
  const shopUrl = getShopifyShopUrl();

  useEffect(() => {
    qrCodes
      .list()
      .then((list) => {
        setTags(list);
        const preferred =
          list.find((t) => t.category === 'person' || t.category === 'medical') ?? list[0] ?? null;
        if (preferred) {
          setIceTagId(preferred.id);
          setIceOn(loadIce(preferred.id));
        }
      })
      .catch(() => setError('Failed to load tags'))
      .finally(() => setLoading(false));
  }, []);

  const iceTag = useMemo(() => tags.find((t) => t.id === iceTagId) ?? null, [tags, iceTagId]);

  function persistIce(next: Record<IceKey, boolean>, id: string) {
    setIceOn(next);
    try {
      localStorage.setItem(`wf_ice_${id}`, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  async function handleMarkLost(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const updated = await qrCodes.markLost(id);
      setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {}
  }

  async function handleMarkFound(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const updated = await qrCodes.markFound(id);
      setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {}
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Unlink this tag?')) return;
    try {
      await qrCodes.delete(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  }

  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();
    setBulkLoading(true);
    setBulkError('');
    try {
      const created = await qrCodes.bulkCreate({ count: bulkCount, category: bulkCategory });
      setTags((prev) => [...prev, ...created]);
      setShowBulkForm(false);
    } catch {
      setBulkError('Failed to generate tags. Check your plan limits and try again.');
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F1E7D8] px-4 py-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">QR TAGS</p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-[#17130F]">Tags &amp; items</h1>
            <p className="mt-2 max-w-[66ch] text-sm text-[#5C5245]">
              Stick a tag on anything. A finder scans it and sees only what you&apos;ve published, never your number or
              email. Click a tag to edit it, add medical info, or report it missing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/reports"
              className="rounded-xl bg-[#17130F] px-3 py-2 text-sm font-bold text-white"
            >
              Report something lost
            </Link>
            <Link
              href="/dashboard/shop"
              className="rounded-xl border border-[#E3D8C6] bg-white px-3 py-2 text-sm font-bold text-[#17130F]"
            >
              Buy tags
            </Link>
            <button
              type="button"
              onClick={() => setLinkOpen(true)}
              className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-bold text-white"
            >
              <Plus className="mr-1 inline h-4 w-4" />
              Link a new tag
            </button>
          </div>
        </div>

        {shopUrl ? (
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-brand-600"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Open store
          </a>
        ) : null}

        {isPremium ? (
          <button
            type="button"
            onClick={() => setShowBulkForm((v) => !v)}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#5C5245]"
          >
            <Layers className="h-4 w-4" />
            Generate multiple
          </button>
        ) : null}

        {isPremium && showBulkForm ? (
          <form onSubmit={handleBulkCreate} className="mt-4 space-y-3 rounded-2xl border border-[#E3D8C6] bg-white p-4">
            <div className="flex gap-3">
              <input
                type="number"
                min={1}
                max={50}
                value={bulkCount}
                onChange={(e) => setBulkCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                className="w-28 rounded-lg border border-[#E3D8C6] px-3 py-2 text-sm"
              />
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="rounded-lg border border-[#E3D8C6] px-3 py-2 text-sm"
              >
                {QR_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={bulkLoading} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white">
                {bulkLoading ? 'Generating…' : 'Generate'}
              </button>
            </div>
            {bulkError ? <p className="text-xs text-red-600">{bulkError}</p> : null}
          </form>
        ) : null}

        {loading ? <p className="py-16 text-[#8A7B67]">Loading…</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 overflow-hidden rounded-2xl border border-[#E3D8C6] bg-white">
          <div className="hidden grid-cols-[48px_1fr_1fr_80px_140px] gap-3 border-b border-[#E3D8C6] px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-[#8A7B67] md:grid">
            <span />
            <span>Item</span>
            <span>Last scanned</span>
            <span>Scans</span>
            <span>Status</span>
          </div>
          {tags.map((tag) => (
            <div
              key={tag.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/dashboard/qr/${tag.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && router.push(`/dashboard/qr/${tag.id}`)}
              className="grid cursor-pointer grid-cols-1 items-center gap-2 border-b border-[#E3D8C6] px-4 py-3 last:border-0 hover:bg-[#FBF7F1] md:grid-cols-[48px_1fr_1fr_80px_140px] md:gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#17130F] text-[10px] font-mono text-white">
                QR
              </div>
              <div>
                <p className="text-sm font-bold text-[#17130F]">{tag.label ?? tag.name}</p>
                <p className="text-xs capitalize text-[#8A7B67]">
                  {tag.category} · {tag.uniqueCode}
                </p>
              </div>
              <p className="text-xs text-[#5C5245]">{new Date(tag.createdAt).toLocaleDateString()}</p>
              <p className="text-xs text-[#5C5245]">—</p>
              <div className="flex items-center gap-2">
                {tag.isLost ? (
                  <span className="rounded-full bg-[#FFF3EE] px-2 py-0.5 text-[11px] font-bold text-brand-600">
                    Reported missing
                  </span>
                ) : (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">Active</span>
                )}
                {tag.isLost ? (
                  <button type="button" className="text-[11px] font-bold" onClick={(e) => void handleMarkFound(tag.id, e)}>
                    Found
                  </button>
                ) : (
                  <button type="button" className="text-[11px] font-bold text-brand-600" onClick={(e) => void handleMarkLost(tag.id, e)}>
                    Missing
                  </button>
                )}
                <button type="button" className="text-[11px] text-red-600" onClick={(e) => void handleDelete(tag.id, e)}>
                  Unlink
                </button>
              </div>
            </div>
          ))}
          {!loading && tags.length === 0 ? (
            <p className="px-4 py-10 text-sm text-[#8A7B67]">No tags linked yet — use Link a new tag.</p>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-[#8A7B67]">
          Free plan: {tags.length} active tags.{' '}
          <Link href="/dashboard/subscription" className="font-extrabold text-brand-600">
            Premium removes the limit →
          </Link>
        </p>

        {iceTag ? (
          <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_280px]">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">MEDICAL &amp; ICE PROFILE</p>
              <h2 className="mt-1 text-xl font-extrabold text-[#17130F]">What a scan can show</h2>
              <p className="mt-2 max-w-[66ch] text-sm text-[#5C5245]">
                Every field is off by default. Turn one on and it appears on the scan page. An addition to a conventional
                medical ID, never a replacement.
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-[#E3D8C6] bg-white">
                {ICE_FIELDS.map((field, i) => (
                  <div
                    key={field.key}
                    className={cn('flex items-center gap-3 px-4 py-3', i < ICE_FIELDS.length - 1 && 'border-b border-[#E3D8C6]')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#17130F]">{field.label}</p>
                      <p className="text-xs text-[#8A7B67]">
                        {field.key === 'name'
                          ? iceTag.label ?? iceTag.name
                          : field.key === 'contacts'
                            ? iceTag.ownerContactEmail || iceTag.ownerContactPhone || 'Add contacts on the tag'
                            : field.key === 'note'
                              ? iceTag.rewardMessage || '—'
                              : iceTag.description || field.hint}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={iceOn[field.key]}
                      onClick={() => persistIce({ ...iceOn, [field.key]: !iceOn[field.key] }, iceTag.id)}
                      className={cn(
                        'flex items-center gap-2 text-xs font-bold',
                        iceOn[field.key] ? 'text-green-700' : 'text-[#8A7B67]',
                      )}
                    >
                      <span
                        className={cn(
                          'relative h-6 w-10 rounded-full',
                          iceOn[field.key] ? 'bg-[#17130F]' : 'bg-[#E3D8C6]',
                        )}
                      >
                        <i
                          className={cn(
                            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                            iceOn[field.key] ? 'left-[18px]' : 'left-0.5',
                          )}
                        />
                      </span>
                      {iceOn[field.key] ? 'Shown on scan' : 'Hidden'}
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[#8A7B67]">
                Linked to: {iceTag.label ?? iceTag.name}.{' '}
                <Link href="/dashboard/shop" className="font-extrabold text-brand-600">
                  Order a medic bracelet
                </Link>
              </p>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">WHAT A FINDER SEES</p>
              <div className="rounded-[28px] border border-[#E3D8C6] bg-[#17130F] p-3 text-white shadow-xl">
                <div className="rounded-[22px] bg-[#FBF7F1] p-4 text-[#17130F]">
                  <p className="text-[10px] font-extrabold tracking-wider text-[#8A7B67]">WILEY FOX · SCAN PAGE</p>
                  {iceOn.name ? (
                    <p className="mt-3 text-lg font-extrabold">{iceTag.label ?? iceTag.name}</p>
                  ) : (
                    <p className="mt-3 text-lg font-extrabold">Wiley Fox tag</p>
                  )}
                  {iceOn.contacts ? (
                    <div className="mt-3 text-xs">
                      <p className="font-bold text-[#8A7B67]">Emergency contacts</p>
                      <p>Relayed — numbers hidden</p>
                    </div>
                  ) : null}
                  {iceOn.note && iceTag.rewardMessage ? (
                    <div className="mt-3 text-xs">
                      <p className="font-bold text-[#8A7B67]">From guardian</p>
                      <p>{iceTag.rewardMessage}</p>
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-xl bg-brand-500 py-2.5 text-center text-xs font-bold text-white">
                    Contact guardian
                  </div>
                  <div className="mt-2 rounded-xl border border-[#E3D8C6] py-2.5 text-center text-xs font-bold">
                    Call 999
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-[#8A7B67]">
                    Your message is relayed. Phone numbers and address are never shown.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {linkOpen ? <LinkTagSheet onClose={() => setLinkOpen(false)} onLinked={(t) => setTags((prev) => [t, ...prev])} /> : null}
    </div>
  );
}

function LinkTagSheet({ onClose, onLinked }: { onClose: () => void; onLinked: (t: QrCode) => void }) {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function continueFromCode() {
    const parsed = code.trim().toUpperCase();
    if (!parsed) {
      setError('Enter the code printed under the QR.');
      return;
    }
    setError('');
    setStep(2);
  }

  async function linkTag() {
    setSaving(true);
    setError('');
    try {
      const created = await publicQr.activate({
        code: code.trim(),
        name: name.trim() || 'New tag',
        category,
      });
      onLinked(created);
      setStep(3);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not link this tag');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#E3D8C6] bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold tracking-wider text-[#8A7B67]">
              {step} · {step === 1 ? 'SCAN' : step === 2 ? 'ASSIGN' : 'DONE'}
            </p>
            <h3 className="mt-1 text-lg font-extrabold">Link a new tag to your profile</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 1 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[#5C5245]">
              Every Wiley Fox tag has a unique QR. Scanning it once, signed in, ties it to your account.
            </p>
            <label className="block text-xs font-bold">Tag code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. WF-7K2-QRB"
              className="w-full rounded-xl border border-[#E3D8C6] px-3 py-2 text-sm uppercase"
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <button type="button" onClick={() => void continueFromCode()} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white">
              Continue
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. School bag"
              className="w-full rounded-xl border border-[#E3D8C6] px-3 py-2 text-sm"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-[#E3D8C6] px-3 py-2 text-sm">
              {QR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => void linkTag()} disabled={saving} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white">
                {saving ? 'Linking…' : 'Link tag'}
              </button>
              <button type="button" onClick={() => setStep(1)} className="rounded-xl border px-4 py-2 text-sm">
                Back
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-[#5C5245]">Linked. Anyone who scans it reaches your profile.</p>
            <button type="button" onClick={onClose} className="rounded-xl bg-[#17130F] px-4 py-2 text-sm font-bold text-white">
              Done
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
