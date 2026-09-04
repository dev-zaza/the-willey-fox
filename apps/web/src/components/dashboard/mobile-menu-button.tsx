'use client';

import { Menu } from 'lucide-react';
import { useMobileNav } from '@/context/mobile-nav-context';
import { cn } from '@/lib/utils';

/** Hamburger control — mobile only. Opens the shared drawer. */
export function MobileMenuButton({ className }: { className?: string }) {
  const { toggle, open } = useMobileNav();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      className={cn(
        'flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-surface-border bg-white/90 text-[#17130F] shadow-sm backdrop-blur lg:hidden',
        className,
      )}
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

/** Slim top bar for non-map dashboard pages on mobile. */
export function MobilePageHeader({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#E3D8C6] bg-[#F1E7D8]/95 px-3 py-2.5 backdrop-blur lg:hidden">
      <MobileMenuButton className="border-[#E3D8C6] bg-white shadow-none" />
      {title ? <h1 className="min-w-0 truncate text-base font-extrabold text-[#17130F]">{title}</h1> : null}
    </header>
  );
}
