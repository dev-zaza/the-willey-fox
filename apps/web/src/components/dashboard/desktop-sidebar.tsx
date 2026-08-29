'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Bell,
  Map,
  MessageSquare,
  Shield,
  Star,
  Tag,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { notifications as notificationsApi } from '@/lib/api';

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon?: typeof Map;
  badge?: number;
  danger?: boolean;
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const panel = searchParams.get('panel');

  useEffect(() => {
    if (!user) return;
    notificationsApi
      .list()
      .then((data) => setUnreadCount(data.unreadCount))
      .catch(() => {
        /* best-effort badge */
      });
  }, [user]);

  const primary: NavItem[] = [
    { id: 'map', href: '/dashboard', label: 'Map', icon: Map },
    { id: 'tags', href: '/dashboard?panel=tags', label: 'Tags', icon: Tag },
    { id: 'alerts', href: '/dashboard?panel=alerts', label: 'Alerts', icon: Bell, badge: unreadCount },
    { id: 'messages', href: '/dashboard?panel=messages', label: 'Inbox', icon: MessageSquare },
    { id: 'places', href: '/dashboard/places', label: 'Places', icon: Star },
  ];

  function isActive(item: NavItem) {
    if (item.id === 'map') return pathname === '/dashboard' && !panel;
    if (item.id === 'tags') return pathname === '/dashboard' && panel === 'tags';
    if (item.id === 'alerts') {
      return (
        (pathname === '/dashboard' && panel === 'alerts') ||
        pathname.startsWith('/dashboard/notifications') ||
        pathname.startsWith('/dashboard/alerts') ||
        pathname.startsWith('/dashboard/reports')
      );
    }
    if (item.id === 'messages') {
      return (pathname === '/dashboard' && panel === 'messages') || pathname.startsWith('/dashboard/messages');
    }
    if (item.id === 'places') return pathname.startsWith('/dashboard/places');
    return false;
  }

  const profileActive =
    pathname.startsWith('/dashboard/profile') ||
    pathname.startsWith('/dashboard/settings') ||
    pathname.startsWith('/dashboard/family') ||
    pathname.startsWith('/dashboard/subscription');

  const sosActive =
    (pathname === '/dashboard' && panel === 'emergency') || pathname.startsWith('/dashboard/emergency');

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

  return (
    <aside
      className="pointer-events-none fixed bottom-0 left-0 top-0 z-40 hidden w-[var(--desktop-rail)] p-3 lg:flex"
      aria-label="Main navigation"
    >
      <div className="pointer-events-auto flex h-full w-full flex-col items-center rounded-[2rem] bg-white py-3 shadow-[0_10px_40px_rgba(27,20,16,0.12)] ring-1 ring-black/[0.04]">
        <Link
          href="/dashboard"
          aria-label="TheWileyfox home"
          className="mb-3 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgba(27,20,16,0.12)] ring-1 ring-black/[0.04] transition-transform duration-200 hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.97]"
        >
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-full" />
        </Link>

        <nav className="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-1" aria-label="Dashboard">
          {primary.map((item) => (
            <RailIcon key={item.id} item={item} active={isActive(item)} />
          ))}
        </nav>

        <div className="mt-2 flex flex-shrink-0 flex-col items-center gap-2">
          <RailIcon
            item={{ id: 'profile', href: '/dashboard/profile', label: 'Profile' }}
            active={profileActive}
            avatar={
              user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                  {initials}
                </span>
              )
            }
          />
          <RailIcon
            item={{
              id: 'emergency',
              href: '/dashboard?panel=emergency',
              label: 'SOS',
              icon: Shield,
              danger: true,
            }}
            active={sosActive}
          />
        </div>
      </div>
    </aside>
  );
}

function RailIcon({
  item,
  active,
  avatar,
}: {
  item: NavItem;
  active: boolean;
  avatar?: ReactNode;
}) {
  const Icon = item.icon;
  const label = item.badge ? `${item.label}, ${item.badge} unread` : item.label;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      className="group relative flex h-11 w-11 cursor-pointer items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] ${
          avatar
            ? active
              ? 'ring-2 ring-brand-500 ring-offset-2'
              : 'ring-2 ring-white'
            : item.danger
              ? active
                ? 'bg-red-500 text-white shadow-[0_6px_16px_rgba(220,38,38,0.35)]'
                : 'bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white'
              : active
                ? 'bg-brand-500 text-white shadow-[0_6px_16px_rgba(234,46,0,0.32)]'
                : 'text-[#7a6957] hover:bg-brand-500/12 hover:text-brand-600'
        }`}
      >
        {avatar ?? (Icon ? <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden /> : null)}
      </span>

      {item.badge != null && item.badge > 0 && (
        <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" aria-hidden />
      )}

      <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 whitespace-nowrap rounded-lg bg-[#1b1410] px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        {item.label}
      </span>
    </Link>
  );
}
