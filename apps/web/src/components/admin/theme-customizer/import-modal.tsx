'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (light: Record<string, string>, dark: Record<string, string>) => void;
}

export function ImportModal({ open, onOpenChange, onImport }: ImportModalProps) {
  const [css, setCss] = React.useState('');
  const [error, setError] = React.useState('');

  function processImport() {
    try {
      setError('');
      if (!css.trim()) { setError('Paste some CSS first.'); return; }

      const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
      const light: Record<string, string> = {};
      const dark: Record<string, string> = {};

      const rootMatch = stripped.match(/:root\s*\{([^}]+)\}/);
      if (rootMatch) {
        for (const m of rootMatch[1].matchAll(/--([^:]+):\s*([^;]+);/g)) {
          light[m[1].trim()] = m[2].trim();
        }
      }

      const darkMatch = stripped.match(/\.dark\s*\{([^}]+)\}/);
      if (darkMatch) {
        for (const m of darkMatch[1].matchAll(/--([^:]+):\s*([^;]+);/g)) {
          dark[m[1].trim()] = m[2].trim();
        }
      }

      if (!Object.keys(light).length && !Object.keys(dark).length) {
        setError('No CSS variables found. Make sure to include :root { } or .dark { } blocks.');
        return;
      }

      onImport(light, dark);
      onOpenChange(false);
      setCss('');
    } catch (e) {
      setError('Failed to parse CSS.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Custom CSS</DialogTitle>
          <DialogDescription>
            Paste CSS with <code className="admin-accent-text">:root</code> (light) and <code className="admin-accent-text">.dark</code> blocks.
            Variables like <code className="admin-text-muted">--primary</code>, <code className="admin-text-muted">--background</code>, etc. will be applied.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-0 space-y-4">
          <textarea
            value={css}
            onChange={(e) => setCss(e.target.value)}
            rows={12}
            placeholder={`:root {\n  --primary: #ea2e00;\n  --background: #ffffff;\n  /* ... */\n}\n.dark {\n  --primary: #cc2900;\n  --background: #0f1117;\n  /* ... */\n}`}
            className="w-full rounded-lg border admin-border-color admin-surface-raised px-3 py-2.5 text-xs font-mono admin-text-color placeholder:admin-text-subtle focus:outline-none admin-accent-ring resize-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg text-sm admin-text-muted admin-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={processImport}
              disabled={!css.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg admin-accent-bg hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Import Theme
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
