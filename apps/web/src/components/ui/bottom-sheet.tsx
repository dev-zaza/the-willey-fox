'use client';

import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  snapPoint?: 'half' | 'full';
}

export function BottomSheet({ open, onClose, children, title, snapPoint = 'half' }: BottomSheetProps) {
  const height = snapPoint === 'full' ? '90vh' : '55vh';

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            style={{ height }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-surface-border rounded-t-2xl flex flex-col"
          >
            {/* Header — drag handle + optional title + close button */}
            <div className="flex items-center flex-shrink-0 px-4 pt-3 pb-2 cursor-grab active:cursor-grabbing">
              {/* Drag handle centered */}
              <div className="flex-1 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-surface-border" />
              </div>
            </div>

            {title && (
              <div className="px-5 pb-3 flex-shrink-0 border-b border-surface-border flex items-center justify-between">
                <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-elevated transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
