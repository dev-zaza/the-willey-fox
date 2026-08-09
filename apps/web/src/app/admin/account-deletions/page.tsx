'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, X, RotateCcw, Loader2, ShieldAlert } from 'lucide-react';
import { admin, type DeletionRequest } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable } from '@/components/admin/data-table';

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  description,
  confirmLabel,
  confirmClass,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border admin-border-color admin-surface p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold admin-text-color">{title}</h2>
          <button onClick={onClose} className="admin-text-subtle admin-hover"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs admin-text-subtle">{description}</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#9d8c7a] hover:text-[#5a4a3d] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${confirmClass}`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Auto-Delete Settings Bar ──────────────────────────────────────────────────

function AutoDeleteSettings() {
  const [autoDelete, setAutoDelete] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    admin.getDeletionSettings().then((s) => setAutoDelete(s.autoDeleteEnabled)).catch(() => {});
  }, []);

  async function toggle() {
    if (autoDelete === null) return;
    setSaving(true);
    try {
      const next = !autoDelete;
      await admin.updateDeletionSettings(next);
      setAutoDelete(next);
    } catch {
      // keep existing state on failure
    } finally {
      setSaving(false);
    }
  }

  if (autoDelete === null) return null;

  return (
    <div className="flex items-center justify-between rounded-xl border admin-border-color admin-surface px-4 py-3 mb-4">
      <div className="flex items-center gap-3">
        <ShieldAlert className={`h-4 w-4 ${autoDelete ? 'text-amber-400' : 'admin-text-subtle'}`} />
        <div>
          <p className="text-sm font-medium admin-text-color">Auto-delete after 90 days</p>
          <p className="text-xs admin-text-subtle">
            {autoDelete
              ? 'Accounts are automatically deleted when their scheduled date passes. Manual review is bypassed.'
              : 'Manual review is required. Requests sit in the queue until an admin approves or cancels them.'}
          </p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
          autoDelete ? 'bg-amber-500' : 'bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            autoDelete ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountDeletionsPage() {
  const [rows, setRows] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    type: 'approve' | 'cancel';
    target: DeletionRequest;
  } | null>(null);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    admin
      .listDeletionRequests(limit, offset)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'name', header: 'User', render: (r: DeletionRequest) => (
      <div>
        <p className="text-sm font-medium admin-text-color">{r.firstName} {r.lastName}</p>
        <p className="text-xs admin-text-subtle">{r.email}</p>
      </div>
    )},
    { key: 'subscriptionTier', header: 'Tier', render: (r: DeletionRequest) => (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        r.subscriptionTier === 'free'
          ? 'bg-gray-500/20 text-gray-400'
          : 'bg-amber-500/20 text-amber-400'
      }`}>
        {r.subscriptionTier}
      </span>
    )},
    { key: 'deletionRequestedAt', header: 'Requested', render: (r: DeletionRequest) => (
      <span className="text-xs admin-text-subtle">
        {new Date(r.deletionRequestedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
    )},
    { key: 'deletionScheduledAt', header: 'Scheduled Deletion', render: (r: DeletionRequest) => {
      const due = new Date(r.deletionScheduledAt);
      const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
      const urgent = daysLeft <= 7;
      return (
        <div>
          <p className={`text-xs font-medium ${urgent ? 'text-amber-400' : 'admin-text-color'}`}>
            {due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-[10px] admin-text-subtle">{daysLeft > 0 ? `${daysLeft}d remaining` : 'Overdue'}</p>
        </div>
      );
    }},
    { key: 'actions', header: '', render: (r: DeletionRequest) => (
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => setModal({ type: 'cancel', target: r })}
          disabled={actionLoading === r.id}
          className="inline-flex items-center gap-1.5 rounded-lg border admin-border-color px-2.5 py-1 text-xs admin-text-muted admin-hover transition-colors disabled:opacity-40"
        >
          <RotateCcw className="h-3 w-3" />
          Cancel Request
        </button>
        <button
          onClick={() => setModal({ type: 'approve', target: r })}
          disabled={actionLoading === r.id}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" />
          Delete Now
        </button>
      </div>
    )},
  ];

  async function handleApprove(id: string) {
    setActionLoading(id);
    await admin.approveDeletion(id);
    setActionLoading(null);
    load();
  }

  async function handleCancel(id: string) {
    setActionLoading(id);
    await admin.cancelDeletion(id);
    setActionLoading(null);
    load();
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-5xl mx-auto">
      <AdminPageHeader
        title="Account Deletion Requests"
        description="GDPR deletion requests pending review. Auto-delete fires at 90 days unless manually actioned."
      />

      <AutoDeleteSettings />

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        getKey={(r) => r.id}
        emptyMessage="No pending deletion requests."
        offset={offset}
        limit={limit}
        onPrev={() => setOffset((o) => Math.max(0, o - limit))}
        onNext={() => setOffset((o) => o + limit)}
      />

      {modal?.type === 'approve' && (
        <ConfirmModal
          title={`Permanently delete ${modal.target.firstName} ${modal.target.lastName}?`}
          description={`This will immediately and permanently delete the account for ${modal.target.email} and all associated data. This cannot be undone.`}
          confirmLabel="Delete permanently"
          confirmClass="bg-red-500/80 hover:bg-red-500 text-white"
          onConfirm={() => handleApprove(modal.target.id)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'cancel' && (
        <ConfirmModal
          title={`Cancel deletion request for ${modal.target.firstName}?`}
          description={`The deletion request for ${modal.target.email} will be removed. The account will remain active.`}
          confirmLabel="Cancel deletion"
          confirmClass="bg-[var(--admin-accent)] hover:opacity-90 text-white"
          onConfirm={() => handleCancel(modal.target.id)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
