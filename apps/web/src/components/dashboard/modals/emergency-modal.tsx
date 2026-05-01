'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Trash2, AlertOctagon, Check, Clock, AlertCircle, Loader2, UserPlus, Sparkles } from 'lucide-react';
import { emergency, users as usersApi, type EmergencyContactRecord, ApiError } from '@/lib/api';

interface EmergencyModalProps {
  onClose?: () => void;
}

type AddMode = 'idle' | 'search' | 'results';

export function EmergencyModal(_: EmergencyModalProps) {
  const [contacts, setContacts] = useState<EmergencyContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addMode, setAddMode] = useState<AddMode>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [addError, setAddError] = useState('');
  const [addLimitReached, setAddLimitReached] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosResult, setSosResult] = useState<{ notifiedCount: number } | null>(null);

  useEffect(() => {
    emergency
      .listContacts()
      .then(setContacts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function search() {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    setAddError('');
    try {
      const results = await usersApi.search(searchQuery.trim());
      setSearchResults(results);
      setAddMode('results');
    } finally {
      setSearching(false);
    }
  }

  async function addContact(userId: string) {
    setAddLoading(true);
    setAddError('');
    setAddLimitReached(false);
    try {
      const contact = await emergency.addContact({ contactUserId: userId });
      setContacts((prev) => [contact, ...prev]);
      setSearchQuery('');
      setSearchResults([]);
      setAddMode('idle');
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 403) {
        setAddLimitReached(true);
      } else {
        setAddError((e as { message?: string })?.message ?? 'Failed to add contact');
      }
    } finally {
      setAddLoading(false);
    }
  }

  function resetAddForm() {
    setAddMode('idle');
    setSearchQuery('');
    setSearchResults([]);
    setAddError('');
    setAddLimitReached(false);
  }

  async function acceptContact(contactId: string) {
    try {
      const updated = await emergency.acceptContact(contactId);
      setContacts((prev) => prev.map((c) => (c.id === contactId ? updated : c)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function removeContact(contactId: string) {
    try {
      await emergency.removeContact(contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function triggerSos() {
    if (!confirm('This will send an SOS alert to all your emergency contacts. Continue?')) return;
    setSosLoading(true);
    setSosResult(null);
    try {
      let lat: number | undefined;
      let lng: number | undefined;

      // Try to get current position
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
            () => resolve(),
            { timeout: 5000 },
          );
        });
      }

      const result = await emergency.triggerSos({ lat, lng });
      setSosResult(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSosLoading(false);
    }
  }

  const acceptedContacts = contacts.filter((c) => c.status === 'accepted');
  const pendingContacts = contacts.filter((c) => c.status === 'pending');

  return (
    <div className="p-5 space-y-4">
      {/* SOS button */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex flex-col items-center gap-3">
        <AlertOctagon className="w-10 h-10 text-red-400" />
        {sosResult ? (
          <p className="text-sm text-green-400 text-center font-medium">
            SOS sent to {sosResult.notifiedCount} contact{sosResult.notifiedCount !== 1 ? 's' : ''}
          </p>
        ) : (
          <p className="text-sm text-[#5a4a3d] text-center">
            Tap SOS to alert all your emergency contacts instantly.
          </p>
        )}
        <button
          onClick={triggerSos}
          disabled={sosLoading || acceptedContacts.length === 0}
          className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          {sosLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertOctagon className="w-4 h-4" />}
          Send SOS Alert
        </button>
        {acceptedContacts.length === 0 && !loading && (
          <p className="text-xs text-[#9d8c7a] text-center">Add accepted contacts to enable SOS</p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-surface-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Accepted contacts */}
          {acceptedContacts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#9d8c7a] uppercase tracking-wider">Emergency Contacts</p>
              {acceptedContacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 glass rounded-xl p-3">
                  <div className="w-9 h-9 rounded-full bg-brand-500/15 flex items-center justify-center flex-shrink-0 text-xs font-medium text-brand-400">
                    {c.contact ? c.contact.firstName[0] + c.contact.lastName[0] : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : 'Unknown'}
                    </p>
                    <p className="text-xs text-[#9d8c7a] truncate">{c.contact?.email}</p>
                  </div>
                  <button
                    onClick={() => removeContact(c.id)}
                    className="text-[#9d8c7a] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pending contacts */}
          {pendingContacts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#9d8c7a] uppercase tracking-wider">Pending</p>
              {pendingContacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 glass rounded-xl p-3 opacity-75">
                  <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : 'Unknown'}
                    </p>
                    <p className="text-xs text-amber-400">
                      {c.isRequester ? 'Awaiting acceptance' : 'Invited you'}
                    </p>
                  </div>
                  {!c.isRequester && (
                    <button
                      onClick={() => acceptContact(c.id)}
                      className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-lg hover:bg-green-500/30 transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Accept
                    </button>
                  )}
                  <button
                    onClick={() => removeContact(c.id)}
                    className="text-[#9d8c7a] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {contacts.length === 0 && (
            <p className="text-center text-sm text-[#9d8c7a] py-4">
              No emergency contacts yet. Search by email or name to add contacts.
            </p>
          )}
        </>
      )}

      {/* Add form — search by email or name */}
      {addMode !== 'idle' ? (
        <div className="glass rounded-xl p-4 space-y-3">
          <p className="text-xs text-[#7a6957]">
            Search by email or name. The person must have a SafeTag account. They will receive a request to accept.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Email or name…"
              className="flex-1 bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-[#9d8c7a] focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={search}
              disabled={searching || searchQuery.trim().length < 2}
              className="py-2 px-4 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white font-medium text-sm"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          {addLimitReached && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-400">Contact limit reached</p>
                <p className="text-xs text-[#7a6957] mt-0.5">
                  Upgrade to Premium to add more emergency contacts.{' '}
                  <Link href="/dashboard/subscription" className="text-brand-400 underline hover:text-brand-300">
                    Upgrade now
                  </Link>
                </p>
              </div>
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center gap-2 border border-surface-border rounded-lg p-2">
                  <div className="w-8 h-8 rounded-full bg-brand-500/15 flex items-center justify-center text-brand-400 text-xs font-bold flex-shrink-0">
                    {u.firstName[0]}{u.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{u.firstName} {u.lastName}</p>
                    <p className="text-[#9d8c7a] text-xs truncate">{u.email}</p>
                  </div>
                  <button
                    onClick={() => addContact(u.id)}
                    disabled={addLoading}
                    className="flex items-center gap-1 bg-brand-500/15 text-brand-400 text-xs font-medium px-2 py-1 rounded hover:bg-brand-500/25 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" /> Add
                  </button>
                </div>
              ))}
            </div>
          )}
          {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && addMode === 'results' && (
            <p className="text-[#9d8c7a] text-xs">No users found. They must register with SafeTag first.</p>
          )}
          <button
            onClick={resetAddForm}
            className="w-full py-2 rounded-lg border border-surface-border text-[#7a6957] text-sm hover:text-white"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddMode('search')}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-[rgba(27,20,16,0.12)] rounded-xl py-3 text-[#7a6957] text-sm hover:border-brand-500/40 hover:text-brand-400 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add emergency contact
        </button>
      )}
    </div>
  );
}
