'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { DesktopSidebar } from './desktop-sidebar';

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMap = pathname === '/dashboard';

  return (
    <>
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <Suspense fallback={null}>
        <DesktopSidebar />
      </Suspense>
      <div
        id="dashboard-main"
        className={isMap ? undefined : 'lg:pl-[var(--desktop-rail)]'}
      >
        {isMap ? children : <div className="lg:mx-auto lg:max-w-4xl">{children}</div>}
      </div>
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return <DashboardShellInner>{children}</DashboardShellInner>;
}
