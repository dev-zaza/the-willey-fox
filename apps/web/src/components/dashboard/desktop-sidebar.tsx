'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Bell,
  Bookmark,
  ChevronLeft,
  Map,
  MessageSquare,
  PanelLeft,
  Shield,
  ShoppingBag,
  Star,
  Tag,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useDesktopRail } from '@/context/desktop-rail-context';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { notifications as notificationsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon?: typeof Map;
  badge?: number;
  danger?: boolean;
  soon?: boolean;
}

export function DesktopSidebar() {
  const isDesktop = useIsDesktop();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { expanded, toggle } = useDesktopRail();
  const [unreadCount, setUnreadCount] = useState(0);
  const panel = searchParams.get('panel');

  useEffect(() => {
    if (!user || !isDesktop) return;
    notificationsApi
      .list()
      .then((data) => setUnreadCount(data.unreadCount))
      .catch(() => {
        /* best-effort badge */
      });
  }, [user, isDesktop]);

  if (!isDesktop) return null;

  const collapsedPrimary: NavItem[] = [
    { id: 'people', href: '/dashboard/people', label: 'Your people', icon: Users },
    { id: 'map', href: '/dashboard', label: 'Map', icon: Map },
    { id: 'tags', href: '/dashboard/qr', label: 'Tags', icon: Tag },
    { id: 'alerts', href: '/dashboard?panel=alerts', label: 'Alerts', icon: Bell, badge: unreadCount },
    { id: 'messages', href: '/dashboard/messages', label: 'Inbox', icon: MessageSquare },
    { id: 'places', href: '/dashboard/places', label: 'Places', icon: Star },
    { id: 'shop', href: '/dashboard/shop', label: 'Shop', icon: ShoppingBag, soon: true },
  ];

  const expandedPrimary: NavItem[] = [
    { id: 'people', href: '/dashboard/people', label: 'Your people', icon: Users },
    { id: 'messages', href: '/dashboard/messages', label: 'Inbox', icon: MessageSquare, badge: unreadCount },
    { id: 'map', href: '/dashboard', label: 'Map', icon: Map },
    { id: 'tags', href: '/dashboard/qr', label: 'Tags & items', icon: Tag },
    { id: 'spots', href: '/dashboard/spots', label: 'Saved places', icon: Bookmark },
  ];

  const expandedSecondary: NavItem[] = [
    { id: 'shop', href: '/dashboard/shop', label: 'Shop', icon: ShoppingBag, soon: true },
    { id: 'profile', href: '/dashboard/profile', label: 'Account', icon: User },
  ];

  const primary = expanded ? expandedPrimary : collapsedPrimary;
  const secondary = expanded ? expandedSecondary : [];

  function isActive(item: NavItem) {
    if (item.id === 'map') return pathname === '/dashboard' && !panel;
    if (item.id === 'tags') {
      return pathname.startsWith('/dashboard/qr') || (pathname === '/dashboard' && panel === 'tags');
    }
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
    if (item.id === 'people') {
      return pathname.startsWith('/dashboard/people') || pathname.startsWith('/dashboard/family');
    }
    if (item.id === 'spots') return pathname.startsWith('/dashboard/spots');
    if (item.id === 'shop') return pathname.startsWith('/dashboard/shop');
    if (item.id === 'profile') {
      return (
        pathname.startsWith('/dashboard/profile') ||
        pathname.startsWith('/dashboard/settings') ||
        pathname.startsWith('/dashboard/subscription')
      );
    }
    return false;
  }

  const profileActive =
    pathname.startsWith('/dashboard/profile') ||
    pathname.startsWith('/dashboard/settings') ||
    pathname.startsWith('/dashboard/subscription');

  const sosActive =
    (pathname === '/dashboard' && panel === 'emergency') || pathname.startsWith('/dashboard/emergency');

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';
  const isFree = !user?.subscriptionTier || user.subscriptionTier === 'free';

  return (
    <aside
      className={cn(
        'pointer-events-none fixed bottom-0 left-0 top-0 z-40 hidden lg:flex',
        'w-[var(--desktop-rail)]',
        expanded ? 'p-0' : 'p-3',
      )}
      aria-label="Main navigation"
    >
      <div
        className={cn(
          'pointer-events-auto flex h-full w-full flex-col bg-white',
          expanded
            ? 'rounded-none border-r border-[#E3D8C6] py-5'
            : 'items-center rounded-[2rem] py-3 shadow-[0_10px_40px_rgba(27,20,16,0.12)] ring-1 ring-black/[0.04]',
        )}
      >
        <Link
          href="/dashboard"
          aria-label="TheWileyfox home"
          className={cn(
            'flex flex-shrink-0 items-center transition-transform duration-200 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            expanded
              ? 'mb-4 gap-2.5 px-5'
              : 'mb-3 h-11 w-11 justify-center rounded-full bg-white shadow-[0_4px_14px_rgba(27,20,16,0.12)] ring-1 ring-black/[0.04]',
          )}
        >
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-full" />
          {expanded ? (
            <span className="text-[17px] font-extrabold tracking-tight text-[#17130F]">WileyFox</span>
          ) : null}
        </Link>

        <nav
          className={cn('flex flex-1 flex-col py-1', expanded ? 'gap-0.5 px-3' : 'items-center gap-2')}
          aria-label="Dashboard"
        >
          {primary.map((item) => (
            <RailItem key={item.id} item={item} active={isActive(item)} expanded={expanded} />
          ))}

          {secondary.map((item) => (
            <RailItem key={item.id} item={item} active={isActive(item)} expanded={expanded} />
          ))}
        </nav>

        <div className={cn('mt-2 flex flex-shrink-0 flex-col gap-2', expanded ? 'px-3' : 'items-center')}>
          {!expanded ? (
            <>
              <RailItem
                item={{ id: 'profile', href: '/dashboard/profile', label: 'Profile', icon: User }}
                active={profileActive}
                expanded={false}
                avatar={
                  user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                      {initials}
                    </span>
                  )
                }
              />
              <RailItem
                item={{
                  id: 'emergency',
                  href: '/dashboard?panel=emergency',
                  label: 'SOS',
                  icon: Shield,
                  danger: true,
                }}
                active={sosActive}
                expanded={false}
              />
            </>
          ) : null}

          {expanded && isFree ? (
            <div className="mt-2 rounded-2xl border border-[#E3D8C6] bg-[#F1E7D8] p-3.5">
              <div className="text-[11px] font-extrabold tracking-[0.1em] text-[#8A7B67]">FREE PLAN</div>
              <p className="mt-1 text-[12.5px] leading-snug text-[#5C5245]">
                Premium adds unlimited tags, 25 emergency contacts and lifetime report history.
              </p>
              <Link
                href="/dashboard/subscription"
                className="mt-2 inline-block text-[12.5px] font-extrabold text-brand-500 hover:text-brand-600"
              >
                See Premium →
              </Link>
            </div>
          ) : null}

          <button
            type="button"
            onClick={toggle}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            className={cn(
              'flex items-center rounded-xl text-[#5C5245] transition-colors hover:bg-[#FBF7F1] hover:text-[#17130F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              expanded ? 'mt-1 w-full gap-2 px-3 py-2.5 text-sm font-semibold' : 'h-11 w-11 justify-center',
            )}
          >
            {expanded ? <ChevronLeft className="h-4 w-4" /> : <PanelLeft className="h-5 w-5" aria-hidden />}
            {expanded ? 'Collapse' : <span className="sr-only">Expand sidebar</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

function RailItem({
  item,
  active,
  expanded,
  avatar,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  avatar?: ReactNode;
}) {
  const Icon = item.icon;
  const label = item.badge
    ? `${item.label}, ${item.badge} unread`
    : item.soon
      ? `${item.label} — coming soon`
      : item.label;

  if (expanded) {
    return (
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
          active
            ? item.danger
              ? 'bg-red-50 text-red-600'
              : 'bg-[#FFF3EE] font-extrabold text-brand-500'
            : item.danger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-[#3E362C] hover:bg-[#FBF7F1]',
        )}
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
          {avatar ?? (Icon ? <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.9} aria-hidden /> : null)}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        {item.soon ? (
          <span className="rounded-full bg-[#E7DCCA] px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wider text-[#8A7B67]">
            SOON
          </span>
        ) : null}
        {item.badge != null && item.badge > 0 ? (
          <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        ) : null}
      </Link>
    );
  }

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
      {item.soon && !(item.badge != null && item.badge > 0) ? (
        <span
          className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#C4B5A0] ring-2 ring-white"
          aria-hidden
        />
      ) : null}

      <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 whitespace-nowrap rounded-lg bg-[#1b1410] px-2.5 py-1 text-xs font-medium text-white text-white-force opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        {item.soon ? `${item.label} · Soon` : item.label}
      </span>
    </Link>
  );
}
