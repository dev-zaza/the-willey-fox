'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, CheckCircle2, Loader2, X } from 'lucide-react';
import { admin, type AdminUserRow } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable, StatusBadge } from '@/components/admin/data-table';

function BanModal({ user, onClose, onBanned }: { user: AdminUserRow; onClose: () => void; onBanned: () => void }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (reason.trim().length < 3) { setError('Reason must be at least 3 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      await admin.banUser(user.id, reason.trim());
      onBanned();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to ban user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border admin-border-color admin-surface p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold admin-text-color">Ban {user.firstName} {user.lastName}</h2>
          <button onClick={onClose} className="admin-text-subtle admin-hover"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs admin-text-subtle">This will suspend the account and notify the user via email.</p>
        <div>
          <label className="block text-xs admin-text-subtle mb-1.5">Reason *</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this account is being suspended…"
            className="w-full rounded-lg border admin-border-color admin-surface-raised px-3 py-2 text-sm admin-text-color placeholder:admin-text-subtle focus:outline-none admin-accent-ring resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#9d8c7a] hover:text-[#5a4a3d] transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Ban User
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUserRow | null>(null);
  const limit = 50;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(() => {
    setLoading(true);
    admin.listUsers(debouncedQuery, limit, offset)
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedQuery, offset]);

  useEffect(() => { load(); }, [load]);

  async function unbanUser(userId: string) {
    setActionLoading(userId);
    try {
      await admin.unbanUser(userId);
      setRows((prev) => prev.map((u) => u.id === userId ? { ...u, isBanned: false } : u));
    } catch {}
    finally { setActionLoading(null); }
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {banTarget && (
        <BanModal
          user={banTarget}
          onClose={() => setBanTarget(null)}
          onBanned={() => setRows((prev) => prev.map((u) => u.id === banTarget.id ? { ...u, isBanned: true } : u))}
        />
      )}

      <AdminPageHeader title="Users" description="Manage registered accounts" />

      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOffset(0); }}
        placeholder="Search by name or email…"
        className="h-9 w-72 rounded-lg border admin-border-color admin-surface px-3 text-sm admin-text-color placeholder:admin-text-subtle focus:outline-none admin-accent-ring"
      />

      <DataTable
        loading={loading}
        data={rows}
        getKey={(r) => r.id}
        offset={offset}
        limit={limit}
        onPrev={() => setOffset((o) => Math.max(0, o - limit))}
        onNext={() => setOffset((o) => o + limit)}
        emptyMessage="No users found"
        columns={[
          {
            key: 'user',
            header: 'User',
            render: (u) => (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full admin-accent-bg-dim admin-accent-text text-xs font-bold shrink-0">
                  {u.firstName?.[0]}{u.lastName?.[0]}
                </div>
                <div>
                  <p className="text-sm font-medium admin-text-color">{u.firstName} {u.lastName}</p>
                  <p className="text-xs admin-text-subtle">{u.email}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'tier',
            header: 'Tier',
            render: (u) => <StatusBadge status={u.subscriptionTier} />,
          },
          {
            key: 'verified',
            header: 'Verified',
            render: (u) => u.isVerified
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              : <span className="text-zinc-700">—</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (u) => u.isBanned
              ? <span className="text-xs font-medium text-red-400">Banned</span>
              : <span className="text-xs admin-text-subtle">Active</span>,
          },
          {
            key: 'joined',
            header: 'Joined',
            render: (u) => <span className="text-xs admin-text-subtle">{new Date(u.createdAt).toLocaleDateString()}</span>,
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (u) => u.isBanned ? (
              <button
                onClick={() => unbanUser(u.id)}
                disabled={actionLoading === u.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
              >
                {actionLoading === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Unban
              </button>
            ) : (
              <button
                onClick={() => setBanTarget(u)}
                disabled={u.isAdmin}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition-colors"
              >
                <Ban className="h-3 w-3" />
                Ban
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
