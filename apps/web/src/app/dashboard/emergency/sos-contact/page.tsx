'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { emergency, type EmergencyContactRecord } from '@/lib/api';

export default function SosContactPage() {
  const [contacts, setContacts] = useState<EmergencyContactRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    emergency.listContacts().then(setContacts).finally(() => setLoading(false));
  }, []);

  async function setPrimary(id: string) {
    const updated = await emergency.setPrimaryContact(id);
    setContacts((prev) =>
      prev.map((c) => ({
        ...c,
        isPrimary: c.id === updated.id,
      })),
    );
  }

  const accepted = contacts.filter((c) => c.status === 'accepted');

  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="border-b border-surface-border bg-surface-card px-4 py-4">
        <Link href="/dashboard/emergency" className="text-sm text-[#7a6957] hover:text-brand-400">
          ← Emergency
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">SOS primary contact</h1>
      </div>

      <div className="mx-auto max-w-md space-y-3 p-4">
        <p className="text-sm text-[#7a6957]">
          Choose who receives SOS alerts first when you trigger an emergency.
        </p>
        {loading && <p className="text-sm text-[#9d8c7a]">Loading…</p>}
        {accepted.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-card p-4">
            <div>
              <p className="font-medium text-white">{c.contact?.firstName} {c.contact?.lastName}</p>
              <p className="text-xs text-[#9d8c7a]">{c.contact?.email}</p>
            </div>
            {c.isPrimary ? (
              <span className="text-xs font-semibold text-brand-400">Primary</span>
            ) : (
              <button type="button" onClick={() => setPrimary(c.id)} className="text-xs text-brand-400 hover:text-brand-300">
                Set primary
              </button>
            )}
          </div>
        ))}
        {!loading && accepted.length === 0 && (
          <p className="text-sm text-[#9d8c7a]">Add accepted emergency contacts first.</p>
        )}
      </div>
    </div>
  );
}
