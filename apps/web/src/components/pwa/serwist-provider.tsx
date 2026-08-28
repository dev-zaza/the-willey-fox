'use client';

import { SerwistProvider } from '@serwist/next/react';
import type { ReactNode } from 'react';

/**
 * Registers the Serwist service worker in production builds.
 * Disabled in development to avoid stale-cache surprises while iterating.
 */
export function SerwistRegister({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === 'development'}>
      {children}
    </SerwistProvider>
  );
}
