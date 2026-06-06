'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Shield, CheckCircle, Trash2, Mail } from 'lucide-react';
import { guardians, type Guardian } from '@/lib/api';

export default function GuardiansPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [list, setList] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    guardians.listForQr(id).then(setList).finally(() => setLoading(false));
  }, [id]);

  async function approve(gId: string) {
    const updated = await guardians.approve(gId);
    setList((prev) => prev.map((g) => (g.id === gId ? updated : g)));
  }

  async function remove(gId: string) {
    if (!confirm('Remove this guardian?')) return;
    await guardians.remove(gId);
    setList((prev) => prev.filter((g) => g.id !== gId));
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const result = await guardians.inviteByEmail(id, inviteEmail.trim());
      if (result.invited) {
        setInviteMsg({ type: 'success', text: `Invite sent to ${result.email}. They'll receive an email to accept.` });
      } else {
        setInviteMsg({ type: 'success', text: `${inviteEmail.trim()} was found and added as a guardian.` });
        // Refresh list
        guardians.listForQr(id).then(setList);
      }
      setInviteEmail('');
    } catch (err: any) {
      const code = err?.code ?? err?.message ?? 'Unknown error';
      setInviteMsg({ type: 'error', text: code === 'GUARDIAN_LIMIT_REACHED' ? 'Guardian limit reached for your plan.' : `Failed: ${code}` });
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/dashboard/qr/${id}`)} className="text-[#7a6957] hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white">Guardian Management</h1>
        </div>

        {/* Invite by email */}
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand-400" /> Invite Guardian by Email
          </h2>
          <form onSubmit={invite} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="guardian@example.com"
              required
              className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--text-muted)] outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
          </form>
          {inviteMsg && (
            <p className={`mt-2 text-xs ${inviteMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {inviteMsg.text}
            </p>
          )}
        </div>

        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          {loading && <p className="text-[#7a6957] text-sm">Loading…</p>}
          {!loading && list.length === 0 && (
            <div className="text-center py-8 text-[#9d8c7a]">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No guardians yet</p>
            </div>
          )}
          <div className="space-y-3">
            {list.map((g) => (
              <div key={g.id} className="flex items-center gap-3 border border-surface-border rounded-xl p-3">
                <div className="w-9 h-9 rounded-full bg-brand-500/15 flex items-center justify-center flex-shrink-0 text-brand-400 font-bold text-sm">
                  {g.guardian.firstName[0]}{g.guardian.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{g.guardian.firstName} {g.guardian.lastName}</p>
                  <p className="text-[#9d8c7a] text-xs">{g.guardian.email}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${
                  g.status === 'approved' ? 'bg-green-500/15 text-green-400' :
                  g.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                  'bg-red-500/15 text-red-400'
                }`}>{g.status}</span>
                {g.status === 'pending' && (
                  <button onClick={() => approve(g.id)} className="text-green-400 hover:text-green-300 transition-colors">
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => remove(g.id)} className="text-[#7a6957] hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
