'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DesktopSidebar } from './desktop-sidebar';
import { MobileNavDrawer } from './mobile-nav-drawer';
import { MobilePageHeader } from './mobile-menu-button';
import { MobileDashboardDock } from './mobile-dashboard-dock';
import { DesktopRailProvider } from '@/context/desktop-rail-context';
import { MobileNavProvider } from '@/context/mobile-nav-context';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useAuth } from '@/context/auth-context';
import { notifications as notificationsApi } from '@/lib/api';

const FULL_BLEED = [
  '/dashboard/messages',
  '/dashboard/shop',
  '/dashboard/people',
  '/dashboard/qr',
  '/dashboard/spots',
  '/dashboard/profile',
  '/dashboard/family',
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard/people': 'Your people',
  '/dashboard/profile': 'Account',
  '/dashboard/shop': 'Shop',
  '/dashboard/qr': 'Tags & items',
  '/dashboard/spots': 'Saved places',
  '/dashboard/places': 'Places',
  '/dashboard/messages': 'Inbox',
  '/dashboard/family': 'Family',
  '/dashboard/notifications': 'Alerts',
  '/dashboard/subscription': 'Plan',
  '/dashboard/settings': 'Settings',
};

function titleFor(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES).find((p) => pathname.startsWith(`${p}/`));
  return match ? PAGE_TITLES[match] : undefined;
}

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const isMap = pathname === '/dashboard';
  const fullBleed = FULL_BLEED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!user || isDesktop) return;
    notificationsApi
      .list()
      .then((data) => setUnreadCount(data.unreadCount))
      .catch(() => {});
  }, [user, isDesktop, pathname]);

  // Never leave desktop-expanded class hanging on mobile
  useEffect(() => {
    if (isDesktop) return;
    document.querySelector('.dashboard')?.classList.remove('rail-expanded');
  }, [isDesktop]);

  return (
    <>
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white text-white-force"
      >
        Skip to main content
      </a>

      {isDesktop ? (
        <Suspense fallback={null}>
          <DesktopSidebar />
        </Suspense>
      ) : null}

      {!isDesktop ? <MobileNavDrawer /> : null}

      <div
        id="dashboard-main"
        className={
          isMap
            ? undefined
            : [
                isDesktop ? 'lg:pl-[var(--desktop-rail)]' : '',
                !isDesktop ? 'pb-24' : '',
                'min-w-0 overflow-x-hidden',
              ]
                .filter(Boolean)
                .join(' ')
        }
      >
        {!isDesktop && !isMap ? <MobilePageHeader title={titleFor(pathname)} /> : null}
        {isMap ? children : fullBleed ? children : <div className="lg:mx-auto lg:max-w-4xl">{children}</div>}
      </div>

      {!isDesktop && !isMap ? <MobileDashboardDock unreadCount={unreadCount} /> : null}
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DesktopRailProvider>
      <MobileNavProvider>
        <DashboardShellInner>{children}</DashboardShellInner>
      </MobileNavProvider>
    </DesktopRailProvider>
  );
}
