'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { families } from '@/lib/api';

export default function FamilyPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [memberEmail, setMemberEmail] = useState('');

  useEffect(() => {
    families.list().then(setItems).finally(() => setLoading(false));
  }, []);

  async function createFamily() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await families.create(name.trim());
      setItems((prev) => [...prev, created]);
      setName('');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to create family');
    } finally {
      setCreating(false);
    }
  }

  async function openFamily(id: string) {
    setSelectedId(id);
    const data = await families.get(id);
    setDetail(data);
  }

  async function addMember() {
    if (!selectedId || !memberEmail.trim()) return;
    await families.addMember(selectedId, { email: memberEmail.trim() });
    setMemberEmail('');
    openFamily(selectedId);
  }

  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="border-b border-surface-border bg-surface-card px-4 py-4">
        <Link href="/dashboard" className="text-sm text-[#7a6957] hover:text-brand-400">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">Family groups</h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {!selectedId ? (
          <>
            <div className="rounded-2xl border border-surface-border bg-surface-card p-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New family name"
                className="w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={createFamily}
                disabled={creating}
                className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create family'}
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-[#9d8c7a]">Loading…</p>
            ) : (
              <div className="space-y-2">
                {items.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => openFamily(f.id)}
                    className="w-full rounded-xl border border-surface-border bg-surface-card p-4 text-left hover:border-brand-500/40"
                  >
                    <p className="font-semibold text-white">{f.name}</p>
                    <p className="text-xs text-[#9d8c7a]">{f.memberCount ?? 0} members</p>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          detail && (
            <div className="space-y-4">
              <button type="button" onClick={() => { setSelectedId(null); setDetail(null); }} className="text-sm text-brand-400">
                ← All families
              </button>
              <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
                <h2 className="text-lg font-bold text-white">{detail.name}</h2>
                <ul className="mt-4 space-y-2">
                  {(detail.members ?? []).map((m: any) => (
                    <li key={m.userId ?? m.id} className="flex items-center justify-between text-sm text-[#5a4a3d]">
                      <span>{m.firstName} {m.lastName} ({m.role})</span>
                      {m.role !== 'owner' && (
                        <button
                          type="button"
                          onClick={() => families.removeMember(selectedId, m.userId).then(() => openFamily(selectedId))}
                          className="text-xs text-red-400"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-surface-border bg-surface-card p-4 space-y-3">
                <input
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="Member email"
                  className="w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-white"
                />
                <button type="button" onClick={addMember} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
                  Invite member
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
