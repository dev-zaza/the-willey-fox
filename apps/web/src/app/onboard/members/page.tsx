'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PawPrint, Plus, Sparkles, User, X } from 'lucide-react';
import { useState } from 'react';
import { families } from '@/lib/api';
import {
  AddFamilyProfileSheet,
  QuickAddChips,
} from '@/components/family/add-family-profile-sheet';
import {
  createAndLinkFamilyProfiles,
  FAMILY_PROFILE_LABELS,
  FamilyProfileLimitError,
  ONBOARD_FAMILY_NAME_KEY,
  ONBOARD_QR_PROFILES_KEY,
  toCreatedQrProfiles,
  type DraftFamilyProfile,
  type FamilyProfileCategory,
} from '@/lib/family-profiles';

export default function OnboardMembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<DraftFamilyProfile[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetRelationship, setSheetRelationship] = useState('');
  const [sheetCategory, setSheetCategory] = useState<FamilyProfileCategory>('person');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function openSheet(relationship = '', category: FamilyProfileCategory = 'person') {
    setSheetRelationship(relationship);
    setSheetCategory(category);
    setSheetOpen(true);
  }

  function addMember(draft: DraftFamilyProfile) {
    setMembers((prev) => [...prev, draft]);
  }

  function removeMember(idx: number) {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (members.length === 0) {
      setError('Add at least one person or pet to create QR profiles for them.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const familyName =
        (typeof window !== 'undefined' && sessionStorage.getItem(ONBOARD_FAMILY_NAME_KEY)) ||
        'My Family';
      const family = await families.create(familyName);
      const created = await createAndLinkFamilyProfiles(family.id, members);
      sessionStorage.removeItem(ONBOARD_FAMILY_NAME_KEY);
      sessionStorage.setItem(ONBOARD_QR_PROFILES_KEY, JSON.stringify(toCreatedQrProfiles(created)));
      sessionStorage.setItem(ONBOARD_FAMILY_NAME_KEY, family.name);
      router.push('/onboard/generating');
    } catch (e: unknown) {
      if (e instanceof FamilyProfileLimitError) {
        sessionStorage.setItem(ONBOARD_QR_PROFILES_KEY, JSON.stringify(toCreatedQrProfiles(e.created)));
        setError(e.message);
        if (e.created.length > 0) {
          router.push('/onboard/generating');
          return;
        }
      } else {
        setError(e instanceof Error ? e.message : 'Setup failed');
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#f0e7d6', color: '#1b1410' }}>
    <div className="mx-auto flex max-w-md flex-col px-6 py-8">
      <Link href="/onboard/group" className="mb-6 text-sm" style={{ color: '#7a6957' }}>
        ← Back
      </Link>

      <div className="mb-6 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 rounded-full"
            style={{ width: i === 1 ? 20 : 8, background: i === 1 ? '#ea2e00' : '#d1d5db' }}
          />
        ))}
      </div>

      <h1 className="text-center text-2xl font-extrabold">Who&apos;s in your group?</h1>
      <p className="mt-2 text-center text-sm leading-6" style={{ color: '#5a4a3d' }}>
        Each person or pet gets a QR safety profile. Kids don&apos;t need an email or account — just add their name.
      </p>

      <div className="mt-8">
        <QuickAddChips onSelect={(relationship, category) => openSheet(relationship, category)} />
      </div>

      {members.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7a6957' }}>
            Members ({members.length})
          </p>
          {members.map((m, i) => {
            const Icon = m.category === 'pet' ? PawPrint : User;
            return (
              <div
                key={`${m.name}-${i}`}
                className="flex items-center gap-3 rounded-2xl border bg-white p-3.5"
                style={{ borderColor: 'rgba(27,20,16,0.12)' }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: '#ffe9d6' }}
                >
                  <Icon className="h-[18px] w-[18px]" style={{ color: '#ea2e00' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{m.name}</p>
                  <p className="text-xs" style={{ color: '#7a6957' }}>
                    {m.relationship || FAMILY_PROFILE_LABELS[m.category]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeMember(i)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"
                  aria-label={`Remove ${m.name}`}
                >
                  <X className="h-4 w-4" style={{ color: '#7a6957' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => openSheet()}
        className="mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3.5 text-sm font-semibold"
        style={{ borderColor: '#ea2e00', color: '#ea2e00' }}
      >
        <Plus className="h-4 w-4" />
        Add a member
      </button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleCreate}
        disabled={loading || members.length === 0}
        className="mt-6 flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white disabled:opacity-40"
        style={{ background: members.length > 0 ? '#ea2e00' : '#d1d5db' }}
      >
        <Sparkles className="h-4 w-4" />
        {loading ? 'Creating…' : 'Create QR profiles'}
      </button>

      <AddFamilyProfileSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={addMember}
        initialRelationship={sheetRelationship}
        initialCategory={sheetCategory}
      />
    </div>
    </div>
  );
}
