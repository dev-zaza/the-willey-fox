'use client';

import Link from 'next/link';
import { NotificationsModal } from '@/components/dashboard/modals/notifications-modal';

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="border-b border-surface-border bg-surface-card px-4 py-4">
        <Link href="/dashboard" className="text-sm text-[#7a6957] hover:text-brand-400">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-bold text-white">Notifications</h1>
      </div>
      <NotificationsModal />
    </div>
  );
}
