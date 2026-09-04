'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bookmark,
  Map,
  MessageSquare,
  ShoppingBag,
  Star,
  Tag,
  User,
  Users,
  X,
  Bell,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useMobileNav } from '@/context/mobile-nav-context';
import { cn } from '@/lib/utils';

const DRAWER_LINKS = [
  { href: '/dashboard/people', label: 'Your people', icon: Users },
  { href: '/dashboard', label: 'Map', icon: Map, exact: true },
  { href: '/dashboard/qr', label: 'Tags & items', icon: Tag },
  { href: '/dashboard/notifications', label: 'Alerts', icon: Bell },
  { href: '/dashboard/messages', label: 'Inbox', icon: MessageSquare },
  { href: '/dashboard/places', label: 'Places', icon: Star },
  { href: '/dashboard/spots', label: 'Saved places', icon: Bookmark },
  { href: '/dashboard/shop', label: 'Shop', icon: ShoppingBag, soon: true },
  { href: '/dashboard/profile', label: 'Account', icon: User },
] as const;

export function MobileNavDrawer() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { open, setOpen } = useMobileNav();

  function go(href: string) {
    setOpen(false);
    if (href === '/dashboard?panel=emergency') {
      router.push('/dashboard?panel=emergency');
      return;
    }
    router.push(href);
  }

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/40 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />
      <aside
        className={cn(
          'fixed bottom-0 left-0 top-0 z-[70] flex w-[min(20rem,88vw)] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!open}
        aria-label="More navigation"
      >
        <div className="flex items-center justify-between border-b border-[#E3D8C6] px-4 py-4">
          <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={28} height={28} className="rounded-full" />
            <span className="text-[17px] font-extrabold tracking-tight text-[#17130F]">WileyFox</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#5C5245] hover:bg-[#FBF7F1]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {DRAWER_LINKS.map((item) => {
            const Icon = item.icon;
            const active = 'exact' in item && item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <button
                key={item.href + item.label}
                type="button"
                onClick={() => go(item.href)}
                className={cn(
                  'mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-semibold',
                  active ? 'bg-[#FFF3EE] font-extrabold text-brand-500' : 'text-[#3E362C] hover:bg-[#FBF7F1]',
                )}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={active ? 2.25 : 1.9} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {'soon' in item && item.soon ? (
                  <span className="rounded-full bg-[#E7DCCA] px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wider text-[#8A7B67]">
                    SOON
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#E3D8C6] p-3">
          <button
            type="button"
            onClick={() => go('/dashboard?panel=emergency')}
            className="flex w-full items-center gap-3 rounded-xl bg-red-50 px-3 py-3 text-left text-[15px] font-bold text-red-600"
          >
            <Shield className="h-[18px] w-[18px]" />
            SOS
          </button>
          <button
            type="button"
            onClick={() => go('/dashboard/profile')}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#FBF7F1]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white text-white-force">
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#17130F]">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="block truncate text-xs text-[#8A7B67]">{user?.email}</span>
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
