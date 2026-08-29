'use client';

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useIsDesktop } from '@/hooks/use-is-desktop';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  snapPoint?: 'half' | 'full';
}

export function BottomSheet({ open, onClose, children, title, snapPoint = 'half' }: BottomSheetProps) {
  const isDesktop = useIsDesktop();
  const reduceMotion = useReducedMotion();
  const height = snapPoint === 'full' ? '90vh' : '55vh';

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80) onClose();
  }

  if (isDesktop) {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="false"
            aria-label={title ?? 'Panel'}
            initial={reduceMotion ? { opacity: 0 } : { x: -28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: -20, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'tween', duration: 0.22, ease: [0.22, 1, 0.36, 1] }
            }
            className="fixed z-30 flex flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-xl"
            style={{
              top: '5.5rem',
              bottom: '1rem',
              left: 'calc(var(--desktop-rail) + 1rem)',
              width: 'var(--desktop-panel)',
            }}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-surface-border px-5 py-3.5">
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {title ?? 'Details'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-surface-elevated"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', damping: 30, stiffness: 300 }
            }
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            style={{ height }}
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl border-t border-surface-border bg-surface"
          >
            <div className="flex flex-shrink-0 cursor-grab items-center px-4 pb-2 pt-3 active:cursor-grabbing">
              <div className="flex flex-1 justify-center">
                <div className="h-1 w-10 rounded-full bg-surface-border" />
              </div>
            </div>

            {title && (
              <div className="flex flex-shrink-0 items-center justify-between border-b border-surface-border px-5 pb-3">
                <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-surface-elevated"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
