'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  PawPrint,
  Plus,
  Tag,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import {
  families,
  type FamilyDetail,
  type FamilyMembership,
} from '@/lib/api';
import {
  AddFamilyProfileSheet,
  QuickAddChips,
} from '@/components/family/add-family-profile-sheet';
import {
  createAndLinkFamilyProfiles,
  FAMILY_PROFILE_LABELS,
  FamilyProfileLimitError,
  type FamilyProfileCategory,
} from '@/lib/family-profiles';

export default function FamilyPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FamilyMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FamilyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetRelationship, setSheetRelationship] = useState('');
  const [sheetCategory, setSheetCategory] = useState<FamilyProfileCategory>('person');
  const [addingProfile, setAddingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const loadList = useCallback(async () => {
    const data = await families.list();
    setItems(data);
  }, []);

  useEffect(() => {
    loadList()
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [loadList]);

  async function createFamily() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await families.create(name.trim());
      setName('');
      await loadList();
      await openFamily(created.id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to create family');
    } finally {
      setCreating(false);
    }
  }

  async function openFamily(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    setInviteError('');
    setProfileError('');
    try {
      const data = await families.get(id);
      setDetail(data);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to load family');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function addMember() {
    if (!selectedId || !memberEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    try {
      await families.addMember(selectedId, { email: memberEmail.trim() });
      setMemberEmail('');
      await openFamily(selectedId);
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  }

  async function addProfile(draft: { name: string; relationship: string; category: FamilyProfileCategory }) {
    if (!selectedId) return;
    setAddingProfile(true);
    setProfileError('');
    try {
      await createAndLinkFamilyProfiles(selectedId, [draft]);
      await openFamily(selectedId);
    } catch (e: unknown) {
      if (e instanceof FamilyProfileLimitError) {
        setProfileError(e.message);
        if (e.created.length > 0) await openFamily(selectedId);
      } else {
        setProfileError(e instanceof Error ? e.message : 'Failed to add profile');
      }
    } finally {
      setAddingProfile(false);
    }
  }

  function openSheet(relationship = '', category: FamilyProfileCategory = 'person') {
    setSheetRelationship(relationship);
    setSheetCategory(category);
    setSheetOpen(true);
  }

  const isOwner = Boolean(user && detail && detail.ownerId === user.id);

  if (selectedId) {
    return (
      <div className="min-h-screen bg-surface pb-8">
        <div className="border-b border-surface-border bg-surface-card px-4 py-4">
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setDetail(null);
            }}
            className="text-sm text-[#7a6957] hover:text-brand-500"
          >
            ← All families
          </button>
          <h1 className="mt-2 text-xl font-bold text-[var(--text-primary)]">
            {detail?.name ?? 'Family'}
          </h1>
        </div>

        <div className="mx-auto max-w-2xl space-y-5 p-4">
          {detailLoading || !detail ? (
            <p className="text-sm text-[#7a6957]">Loading…</p>
          ) : (
            <>
              <section>
                <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-[#7a6957]">
                  People with accounts · {detail.members.length}
                </p>
                <p className="mb-3 px-1 text-xs leading-5 text-[#7a6957]">
                  Invite adults who already have a Wiley Fox account. Kids don&apos;t need email — add them as QR profiles below.
                </p>
                <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
                  {detail.members.map((m, i) => {
                    const isMe = m.userId === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          i < detail.members.length - 1 ? 'border-b border-surface-border' : ''
                        }`}
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-500">
                          {(m.firstName?.[0] ?? '') + (m.lastName?.[0] ?? '') || <User className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {m.firstName} {m.lastName}
                            {isMe ? ' (you)' : ''}
                          </p>
                          <p className="truncate text-xs text-[#7a6957]">{m.email}</p>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                            m.role === 'owner' ? 'bg-green-50 text-green-700' : 'bg-black/5 text-[#7a6957]'
                          }`}
                        >
                          {m.role}
                        </span>
                        {isOwner && m.role !== 'owner' && (
                          <button
                            type="button"
                            onClick={() =>
                              families.removeMember(selectedId, m.userId).then(() => openFamily(selectedId))
                            }
                            className="text-xs font-medium text-red-500"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isOwner && (
                  <div className="mt-3 space-y-2 rounded-2xl border border-surface-border bg-surface-card p-4">
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addMember()}
                        placeholder="Adult member email"
                        className="flex-1 rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[#9d8c7a]"
                      />
                      <button
                        type="button"
                        onClick={addMember}
                        disabled={inviting || !memberEmail.trim()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        <UserPlus className="h-4 w-4" />
                        {inviting ? '…' : 'Invite'}
                      </button>
                    </div>
                    {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
                  </div>
                )}
              </section>

              <section>
                <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-[#7a6957]">
                  QR profiles · {detail.qrCodes.length}
                </p>
                <p className="mb-3 px-1 text-xs leading-5 text-[#7a6957]">
                  Kids, pets, and others without an account. Each one gets a QR safety tag.
                </p>

                {isOwner && (
                  <div className={`mb-3 ${addingProfile ? 'pointer-events-none opacity-50' : ''}`}>
                    <QuickAddChips onSelect={(relationship, category) => openSheet(relationship, category)} />
                  </div>
                )}

                {detail.qrCodes.length === 0 ? (
                  <div className="rounded-2xl border border-surface-border bg-surface-card px-4 py-8 text-center">
                    <Tag className="mx-auto h-7 w-7 text-[#9d8c7a]" />
                    <p className="mt-2 text-sm text-[#7a6957]">
                      No QR profiles yet. Add a child or pet by name — no email needed.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
                    {detail.qrCodes.map((qr, i) => {
                      const Icon = qr.category === 'pet' ? PawPrint : User;
                      return (
                        <Link
                          key={qr.id}
                          href={`/dashboard/qr/${qr.id}`}
                          className={`flex items-center gap-3 px-4 py-3 hover:bg-black/5 ${
                            i < detail.qrCodes.length - 1 ? 'border-b border-surface-border' : ''
                          }`}
                        >
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/10">
                            <Icon className="h-4 w-4 text-brand-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{qr.name}</p>
                            <p className="text-xs capitalize text-[#7a6957]">
                              {FAMILY_PROFILE_LABELS[qr.category as 'person' | 'pet'] ?? qr.category}
                            </p>
                          </div>
                          {qr.isLost && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              Lost
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {isOwner && (
                  <>
                    <button
                      type="button"
                      onClick={() => openSheet()}
                      disabled={addingProfile}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-500 py-3.5 text-sm font-semibold text-brand-500 disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                      {addingProfile ? 'Adding…' : 'Add a child, pet, or profile'}
                    </button>
                    {profileError && <p className="mt-2 text-xs text-red-600">{profileError}</p>}
                  </>
                )}
              </section>
            </>
          )}
        </div>

        <AddFamilyProfileSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onAdd={addProfile}
          initialRelationship={sheetRelationship}
          initialCategory={sheetCategory}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1E7D8] pb-8">
      <div className="border-b border-[#E3D8C6] bg-white px-4 py-5 lg:px-10">
        <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">SAFETY NETWORK</p>
        <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-[#17130F]">Your family group</h1>
        <p className="mt-1 max-w-[66ch] text-sm text-[#5C5245]">
          Guardians can respond for a protected person. Emergency contacts are called first on SOS.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="space-y-3 rounded-2xl border border-surface-border bg-surface-card p-4">
          <p className="text-sm text-[#7a6957]">
            Share QR tags with people you trust. Kids and pets are added by name, not email.
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createFamily()}
            placeholder="New family name"
            className="w-full rounded-xl border border-[#E3D8C6] bg-[#FBF7F1] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[#9d8c7a]"
          />
          <button
            type="button"
            onClick={createFamily}
            disabled={creating || !name.trim()}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create family'}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[#7a6957]">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-surface-border bg-surface-card px-4 py-10 text-center">
            <Users className="mx-auto h-10 w-10 text-brand-500" />
            <p className="mt-3 font-semibold text-[var(--text-primary)]">No family groups</p>
            <p className="mt-1 text-sm text-[#7a6957]">
              Create a group, then add kids by name and invite other adults by email.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((f) => (
              <button
                key={f.familyId}
                type="button"
                onClick={() => openFamily(f.familyId)}
                className="w-full rounded-xl border border-surface-border bg-surface-card p-4 text-left hover:border-brand-500/40"
              >
                <p className="font-semibold text-[var(--text-primary)]">{f.familyName}</p>
                <p className="mt-0.5 text-xs capitalize text-[#7a6957]">{f.role}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
