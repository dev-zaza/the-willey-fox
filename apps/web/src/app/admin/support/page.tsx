'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { admin, type SupportTicket } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/page-header';
import { DataTable, StatusBadge } from '@/components/admin/data-table';

export default function SupportTicketsPage() {
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    admin.listSupportTickets(limit, offset, statusFilter || undefined)
      .then((res) => { setRows(res.rows); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [offset, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openTicket(ticket: SupportTicket) {
    setSelected(ticket);
    setReplyText('');
  }

  async function updateStatus(id: string, status: string) {
    const updated = await admin.updateSupportTicket(id, { status });
    setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    setSelected((prev) => (prev?.id === id ? updated : prev));
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    setSaving(true);
    try {
      const updated = await admin.updateSupportTicket(selected.id, {
        adminReply: replyText.trim(),
        status: 'resolved',
      });
      setRows((prev) => prev.map((r) => (r.id === selected.id ? updated : r)));
      setSelected(updated);
      setReplyText('');
    } catch {}
    finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <AdminPageHeader title="Support Tickets" description={`${total} ticket${total === 1 ? '' : 's'} submitted via /support`} />

      <select
        value={statusFilter}
        onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
        className="h-9 rounded-lg border admin-border-color admin-surface px-3 text-sm admin-text-color focus:outline-none admin-accent-ring"
      >
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In progress</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>

      <DataTable
        loading={loading}
        data={rows}
        getKey={(r) => r.id}
        offset={offset}
        limit={limit}
        onPrev={() => setOffset((o) => Math.max(0, o - limit))}
        onNext={() => setOffset((o) => o + limit)}
        emptyMessage="No support tickets"
        columns={[
          {
            key: 'date',
            header: 'Date',
            render: (r) => <span className="text-xs admin-text-subtle">{new Date(r.createdAt).toLocaleDateString()}</span>,
          },
          {
            key: 'from',
            header: 'From',
            render: (r) => (
              <div>
                <p className="text-xs font-medium admin-text-color">{r.name}</p>
                <p className="text-[11px] admin-text-subtle">{r.email}</p>
              </div>
            ),
          },
          {
            key: 'subject',
            header: 'Subject',
            className: 'max-w-64',
            render: (r) => <span className="text-xs admin-text-color truncate block">{r.subject}</span>,
          },
          {
            key: 'account',
            header: 'Account',
            render: (r) => <span className="text-xs admin-text-subtle">{r.userId ? 'Registered' : 'Guest'}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (r) => (
              <button
                onClick={() => openTicket(r)}
                className="inline-flex items-center gap-1.5 rounded-lg border admin-border-color admin-surface-raised px-2.5 py-1 text-xs admin-text-muted admin-hover transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                View
              </button>
            ),
          },
        ]}
      />

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="admin-surface rounded-2xl border admin-border-color shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b admin-border-color">
              <div>
                <h2 className="text-base font-semibold admin-text-color">{selected.subject}</h2>
                <p className="text-xs admin-text-subtle mt-0.5">{selected.name} &lt;{selected.email}&gt;</p>
              </div>
              <button onClick={() => setSelected(null)} className="admin-text-subtle hover:admin-text-muted text-lg leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-center gap-2">
                <StatusBadge status={selected.status} />
                <select
                  value={selected.status}
                  onChange={(e) => updateStatus(selected.id, e.target.value)}
                  className="h-8 rounded-lg border admin-border-color admin-surface px-2 text-xs admin-text-color focus:outline-none admin-accent-ring"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <p className="text-xs font-medium admin-text-subtle mb-1.5">Message</p>
                <p className="text-sm admin-text-color whitespace-pre-wrap rounded-lg border admin-border-color admin-surface-raised p-3">
                  {selected.message}
                </p>
              </div>

              {selected.adminReply && (
                <div>
                  <p className="text-xs font-medium admin-text-subtle mb-1.5">
                    Previous reply {selected.repliedAt && `· ${new Date(selected.repliedAt).toLocaleString()}`}
                  </p>
                  <p className="text-sm admin-text-muted whitespace-pre-wrap rounded-lg border admin-border-color p-3">
                    {selected.adminReply}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium admin-text-subtle">Reply by email</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  placeholder="Write a reply — this will be emailed to the requester and marks the ticket resolved."
                  className="w-full admin-surface-card border admin-border-color rounded-lg px-3 py-2 text-sm admin-text-color focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t admin-border-color">
              <button onClick={() => setSelected(null)} className="text-sm admin-text-muted admin-hover px-3 py-1.5 rounded-lg">
                Close
              </button>
              <button
                onClick={sendReply}
                disabled={saving || !replyText.trim()}
                className="inline-flex items-center gap-1.5 admin-accent-bg text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Send reply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
