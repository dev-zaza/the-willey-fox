'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'wf_desktop_rail_expanded';

interface DesktopRailContextValue {
  expanded: boolean;
  setExpanded: (next: boolean) => void;
  toggle: () => void;
}

const DesktopRailContext = createContext<DesktopRailContextValue | null>(null);

export function DesktopRailProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpandedState] = useState(false);

  useEffect(() => {
    try {
      setExpandedState(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const root = document.querySelector('.dashboard');
    if (!root) return;
    root.classList.toggle('rail-expanded', expanded);
  }, [expanded]);

  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setExpandedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <DesktopRailContext.Provider value={{ expanded, setExpanded, toggle }}>
      {children}
    </DesktopRailContext.Provider>
  );
}

export function useDesktopRail() {
  const ctx = useContext(DesktopRailContext);
  if (!ctx) {
    return {
      expanded: false,
      setExpanded: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}
