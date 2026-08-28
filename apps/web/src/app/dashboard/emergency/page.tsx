'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Shield, UserPlus, Trash2, Check, AlertTriangle } from 'lucide-react';
import { emergency, users as usersApi, type EmergencyContactRecord } from '@/lib/api';

type View = 'main' | 'add';

export default function EmergencyPage() {
  const [contacts, setContacts] = useState<EmergencyContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosMessage, setSosMessage] = useState('');

  useEffect(() => {
    emergency.listContacts().then(setContacts).finally(() => setLoading(false));
  }, []);

  async function search() {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await usersApi.search(searchQuery.trim());
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  async function addContact(userId: string) {
    try {
      const contact = await emergency.addContact({ contactUserId: userId });
      setContacts((prev) => [contact, ...prev]);
      setView('main');
      setSearchQuery('');
      setSearchResults([]);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to add contact');
    }
  }

  async function acceptContact(id: string) {
    const updated = await emergency.acceptContact(id);
    setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  async function removeContact(id: string) {
    if (!confirm('Remove this emergency contact?')) return;
    await emergency.removeContact(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  async function triggerSos() {
    const acceptedCount = contacts.filter((c) => c.status === 'accepted').length;
    if (acceptedCount === 0) { alert('Add accepted contacts first'); return; }
    if (!confirm(`Send SOS to ${acceptedCount} contact${acceptedCount !== 1 ? 's' : ''}?`)) return;

    setSosLoading(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
          () => resolve(),
          { timeout: 5000 },
        );
      });
      const result = await emergency.triggerSos({ lat, lng, message: sosMessage || undefined });
      setSosMessage('');
      alert(`SOS sent to ${result.notifiedCount} contact${result.notifiedCount !== 1 ? 's' : ''}. Help is on the way.`);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to send SOS');
    } finally {
      setSosLoading(false);
    }
  }

  const accepted = contacts.filter((c) => c.status === 'accepted');
  const pending = contacts.filter((c) => c.status === 'pending');

  if (view === 'add') {
    return (
      <div className="min-h-screen bg-surface p-6">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setView('main'); setSearchResults([]); setSearchQuery(''); }} className="text-[#7a6957] hover:text-white transition-colors text-sm font-semibold">← Back</button>
            <h1 className="text-xl font-bold text-white">Add Emergency Contact</h1>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <p className="text-[#7a6957] text-sm">Search for a TheWileyfox user to add as your emergency contact. They will receive a request to accept.</p>
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Name or email…"
                className="flex-1 bg-surface border border-surface-border text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500 placeholder:text-[var(--text-muted)]"
              />
              <button
                onClick={search}
                disabled={searching || searchQuery.trim().length < 2}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {searching ? '…' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 border border-surface-border rounded-xl p-3">
                    <div className="w-9 h-9 rounded-full bg-brand-500/15 flex items-center justify-center text-brand-400 font-bold text-xs flex-shrink-0">
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{u.firstName} {u.lastName}</p>
                      <p className="text-[#9d8c7a] text-xs">{u.email}</p>
                    </div>
                    <button
                      onClick={() => addContact(u.id)}
                      className="flex items-center gap-1 bg-brand-500/15 text-brand-400 text-xs font-medium px-2 py-1 rounded-lg hover:bg-brand-500/25 transition-colors"
                    >
                      <UserPlus className="w-3 h-3" /> Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchQuery.trim().length >= 2 && !searching && (
              <p className="text-[#9d8c7a] text-sm text-center py-4">No users found</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Emergency</h1>
          <button
            onClick={() => setView('add')}
            className="flex items-center gap-2 bg-brand-500/10 border border-brand-500/30 text-brand-400 text-sm font-semibold px-3 py-1.5 rounded-xl hover:bg-brand-500/20 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Add Contact
          </button>
        </div>

        <Link href="/dashboard/emergency/sos-contact" className="inline-flex text-sm text-brand-400 hover:text-brand-300">
          Set SOS primary contact →
        </Link>

        {/* SOS Panel */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 text-center space-y-4">
          <p className="text-5xl">🆘</p>
          <div>
            <p className="text-white font-bold text-lg">Emergency SOS</p>
            <p className="text-[#7a6957] text-sm mt-1">Instantly alerts all accepted contacts with your GPS location.</p>
          </div>
          <textarea
            value={sosMessage}
            onChange={(e) => setSosMessage(e.target.value)}
            placeholder="Optional message to include…"
            rows={2}
            maxLength={500}
            className="w-full bg-surface border border-surface-border text-white text-sm rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-red-500/60 placeholder:text-[var(--text-muted)]"
          />
          <button
            onClick={triggerSos}
            disabled={sosLoading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" />
            {sosLoading ? 'Sending…' : 'Send SOS Alert'}
          </button>
          {accepted.length === 0 && !loading && (
            <p className="text-[#9d8c7a] text-xs">Add accepted contacts to enable SOS</p>
          )}
        </div>

        {loading && <div className="text-center text-[#7a6957] text-sm py-4">Loading…</div>}

        {/* Accepted */}
        {accepted.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#9d8c7a] uppercase tracking-wider">Emergency Contacts</p>
            {accepted.map((c) => (
              <div key={c.id} className="bg-surface-card border border-surface-border rounded-2xl p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-brand-500/15 flex items-center justify-center text-brand-400 font-bold text-sm flex-shrink-0">
                  {c.contact ? `${c.contact.firstName[0]}${c.contact.lastName[0]}` : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : 'Unknown'}</p>
                  <p className="text-[#9d8c7a] text-xs truncate">{c.contact?.email}</p>
                </div>
                <button onClick={() => removeContact(c.id)} className="text-[#7a6957] hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#9d8c7a] uppercase tracking-wider">Pending</p>
            {pending.map((c) => (
              <div key={c.id} className="bg-surface-card border border-surface-border rounded-2xl p-4 flex items-center gap-4 opacity-80">
                <div className="w-11 h-11 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 text-xl flex-shrink-0">⏳</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : 'Unknown'}</p>
                  <p className="text-amber-400 text-xs">{c.isRequester ? 'Awaiting acceptance' : 'Invited you'}</p>
                </div>
                {!c.isRequester && (
                  <button
                    onClick={() => acceptContact(c.id)}
                    className="flex items-center gap-1 bg-green-500/15 text-green-400 text-xs font-medium px-2 py-1 rounded-lg hover:bg-green-500/25 transition-colors"
                  >
                    <Check className="w-3 h-3" /> Accept
                  </button>
                )}
                <button onClick={() => removeContact(c.id)} className="text-[#7a6957] hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && contacts.length === 0 && (
          <div className="text-center py-12 text-[#9d8c7a]">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-white">No Contacts Yet</p>
            <p className="text-sm mt-1">Add emergency contacts who'll be alerted during SOS</p>
          </div>
        )}
      </div>
    </div>
  );
}
