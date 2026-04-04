'use client';

import Link from 'next/link';
import { LogOut, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, logout } = useAuth();

  return (
    <div className="p-5 space-y-5">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-20 h-20 rounded-full bg-brand-500/20 border-2 border-brand-500/40 flex items-center justify-center">
          <span className="text-3xl font-bold text-brand-400">
            {user?.firstName?.[0]?.toUpperCase() ?? 'U'}
          </span>
        </div>
        <div className="text-center">
          <p className="font-bold text-white text-lg">{user ? `${user.firstName} ${user.lastName}` : '—'}</p>
          <p className="text-sm text-slate-400">TheWileyfox member</p>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-2">
        {user?.email && (
          <div className="flex items-center gap-3 bg-surface-elevated rounded-lg px-4 py-3">
            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-300">{user.email}</span>
          </div>
        )}
        {user?.phone && (
          <div className="flex items-center gap-3 bg-surface-elevated rounded-lg px-4 py-3">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-300">{user.phone}</span>
          </div>
        )}
      </div>

      {/* Admin link */}
      {user?.isAdmin && (
        <Link
          href="/admin"
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-brand-500/30 text-brand-400 hover:bg-brand-500/10 transition-colors text-sm font-medium"
        >
          <ShieldCheck className="w-4 h-4" />
          Admin Panel
        </Link>
      )}

      {/* Actions */}
      <button
        onClick={() => { onClose(); logout(); }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  );
}
