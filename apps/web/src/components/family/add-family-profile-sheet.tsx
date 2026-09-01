'use client';

import { Heart, PawPrint, Smile, User, Users, X } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  FAMILY_PROFILE_LABELS,
  type DraftFamilyProfile,
  type FamilyProfileCategory,
} from '@/lib/family-profiles';

export const QUICK_ADD = [
  { label: 'Partner', icon: Heart, category: 'person' as const },
  { label: 'Child', icon: Smile, category: 'person' as const },
  { label: 'Parent', icon: Users, category: 'person' as const },
  { label: 'Pet', icon: PawPrint, category: 'pet' as const },
];

interface AddFamilyProfileSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (draft: DraftFamilyProfile) => void;
  initialRelationship?: string;
  initialCategory?: FamilyProfileCategory;
}

export function AddFamilyProfileSheet({
  open,
  onClose,
  onAdd,
  initialRelationship = '',
  initialCategory = 'person',
}: AddFamilyProfileSheetProps) {
  const titleId = useId();
  const nameId = useId();
  const relationshipId = useId();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState(initialRelationship);
  const [category, setCategory] = useState<FamilyProfileCategory>(initialCategory);

  useEffect(() => {
    if (!open) return;
    setName('');
    setRelationship(initialRelationship);
    setCategory(initialCategory);
  }, [open, initialRelationship, initialCategory]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      relationship: relationship.trim(),
      category,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold" style={{ color: '#1b1410' }}>
            Add member
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" style={{ color: '#7a6957' }} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={nameId} className="text-sm font-semibold" style={{ color: '#1b1410' }}>
              Name *
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah"
              autoFocus
              className="w-full rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: 'rgba(27,20,16,0.15)', background: '#f0e7d6', color: '#1b1410' }}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={relationshipId} className="text-sm font-semibold" style={{ color: '#1b1410' }}>
              Relationship (optional)
            </label>
            <input
              id={relationshipId}
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="e.g. Partner, Child, Parent"
              className="w-full rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: 'rgba(27,20,16,0.15)', background: '#f0e7d6', color: '#1b1410' }}
            />
          </div>

          <div className="flex gap-2">
            {(['person', 'pet'] as const).map((cat) => {
              const selected = category === cat;
              const Icon = cat === 'pet' ? PawPrint : User;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className="flex flex-1 flex-col items-center rounded-xl border-2 py-2.5"
                  style={{
                    background: selected ? 'rgba(234,46,0,0.08)' : '#f0e7d6',
                    borderColor: selected ? '#ea2e00' : 'rgba(27,20,16,0.12)',
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: selected ? '#ea2e00' : '#7a6957' }} />
                  <span
                    className="mt-1 text-xs font-semibold"
                    style={{ color: selected ? '#ea2e00' : '#7a6957' }}
                  >
                    {FAMILY_PROFILE_LABELS[cat]}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-40"
            style={{ background: '#ea2e00' }}
          >
            Add to group
          </button>
        </div>
      </form>
    </div>
  );
}

export function QuickAddChips({
  onSelect,
}: {
  onSelect: (relationship: string, category: FamilyProfileCategory) => void;
}) {
  return (
    <div>
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: '#7a6957' }}>
        Quick add
      </p>
      <div className="flex flex-wrap gap-2">
        {QUICK_ADD.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onSelect(item.label, item.category)}
              className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3.5 py-2 text-sm font-semibold"
              style={{ borderColor: 'rgba(27,20,16,0.12)', color: '#1b1410' }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: '#ea2e00' }} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
