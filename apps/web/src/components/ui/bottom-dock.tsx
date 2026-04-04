'use client';

import type { ReactNode } from 'react';

export interface DockItem {
  id: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}

interface BottomDockProps {
  items: DockItem[];
  activeId?: string;
  onSelect: (id: string) => void;
}

export function BottomDock({ items, activeId, onSelect }: BottomDockProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
      <div className="glass border-t border-surface-border">
        <div className="flex items-center justify-around px-2 py-2">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className="relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all"
                aria-label={item.label}
              >
                {item.badge != null && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
                <span
                  className={`text-xl transition-transform ${
                    isActive ? 'text-brand-400 scale-110' : 'text-slate-400'
                  }`}
                >
                  {item.icon}
                </span>
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? 'text-brand-400' : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
