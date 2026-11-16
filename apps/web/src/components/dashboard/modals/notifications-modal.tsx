'use client';

import { useEffect, useState } from 'react';
import { Bell, Mail, Smartphone, AlertCircle, CheckCheck, Loader2 } from 'lucide-react';
import { notifications as notificationsApi, type NotificationLog } from '@/lib/api';

interface NotificationsModalProps {
  onClose?: () => void;
  onMarkRead?: () => void;
}

function typeIcon(type: string) {
  if (type === 'email') return <Mail className="w-4 h-4 text-blue-400" />;
  if (type === 'sms') return <Smartphone className="w-4 h-4 text-green-400" />;
  return <Bell className="w-4 h-4 text-brand-400" />;
}

function relativeTime(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function toneForNotification(item: NotificationLog): { iconClass: string; borderClass: string } {
  const hay = `${item.subject ?? ''} ${item.body ?? ''}`.toLowerCase();
  if (hay.includes('missing') || hay.includes('sos') || hay.includes('emergency')) {
    return { iconClass: 'text-red-500', borderClass: 'border-red-200 bg-red-50/60' };
  }
  if (hay.includes('found') || hay.includes('good news') || hay.includes('accepted')) {
    return { iconClass: 'text-emerald-600', borderClass: 'border-emerald-200 bg-emerald-50/50' };
  }
  return { iconClass: 'text-brand-500', borderClass: 'border-[#E3D8C6] bg-white' };
}

export function NotificationsModal({ onMarkRead }: NotificationsModalProps) {
  const [items, setItems] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    notificationsApi
      .list()
      .then((data) => setItems(data.notifications))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleMarkRead() {
    setMarking(true);
    try {
      await notificationsApi.markRead();
      onMarkRead?.();
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-[#9d8c7a] uppercase tracking-wider">Alerts</p>
          <p className="text-[11px] text-[#8A7B67]">System notices · Messages are in Inbox</p>
        </div>
        <button
          onClick={handleMarkRead}
          disabled={marking || items.length === 0}
          className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 disabled:opacity-40 transition-colors"
        >
          {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
          Mark all read
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-surface-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-[#9d8c7a]">
          <Bell className="w-10 h-10 opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const tone = toneForNotification(item);
            return (
            <div key={item.id} className={`rounded-xl border p-3 flex items-start gap-3 ${tone.borderClass}`}>
              <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5 ${tone.iconClass}`}>
                {typeIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                {item.subject && (
                  <p className="text-sm font-semibold text-[#17130F] whitespace-normal break-words">{item.subject}</p>
                )}
                <p className="text-xs text-[#5C5245] whitespace-normal break-words mt-0.5">{item.body}</p>
                <p className="text-xs text-[#8A7B67] mt-1" title={new Date(item.createdAt).toLocaleString()}>
                  {relativeTime(item.createdAt)}
                </p>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                item.status === 'sent' ? 'bg-green-500/15 text-green-700' :
                item.status === 'failed' ? 'bg-red-500/15 text-red-600' :
                'bg-[#F1E7D8] text-[#8A7B67]'
              }`}>
                {item.status}
              </span>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
