'use client';

import * as React from 'react';
import {
  Settings,
  X,
  RotateCcw,
  Palette,
  Sun,
  Moon,
  Upload,
  Check,
  Monitor,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { THEME_PRESETS, RADIUS_OPTIONS } from './theme-presets';
import { useThemeManager } from './use-theme-manager';
import { ImportModal } from './import-modal';
import { useSidebar } from '../admin-sidebar';

// ── Trigger button ────────────────────────────────────────────────────────────

export function ThemeCustomizerTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Customize theme"
      className="fixed right-4 bottom-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-[#7a6957] shadow-lg hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
    >
      <Settings className="h-4 w-4" />
    </button>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface ThemeCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemeCustomizer({ open, onOpenChange }: ThemeCustomizerProps) {
  const { selectedTheme, isDark, radius, changeTheme, toggleDark, changeRadius, reset } = useThemeManager();
  const [activeTab, setActiveTab] = React.useState<'theme' | 'layout'>('theme');
  const [importOpen, setImportOpen] = React.useState(false);
  const { collapsed, setCollapsed } = useSidebar();

  function handleImport(light: Record<string, string>, dark: Record<string, string>) {
    const root = document.documentElement;
    const vars = isDark ? dark : light;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 flex w-80 flex-col border-l admin-border-color admin-surface shadow-2xl"
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b admin-border-color px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg admin-accent-bg-dim">
              <Settings className="h-3.5 w-3.5 admin-accent-text" />
            </div>
            <p className="text-sm font-semibold admin-text-color">Customizer</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={reset}
              title="Reset to defaults"
              className="flex h-7 w-7 items-center justify-center rounded-md admin-text-subtle admin-hover transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md admin-text-subtle admin-hover transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b admin-border-color">
          {(['theme', 'layout'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2.5 text-xs font-medium capitalize transition-colors border-b-2',
                activeTab === tab
                  ? 'admin-accent-border admin-accent-text'
                  : 'border-transparent text-[#9d8c7a] hover:text-[#5a4a3d]',
              )}
            >
              {tab === 'theme' ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" /> Theme
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5" /> Layout
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'theme' ? (
            <ThemeTab
              selectedTheme={selectedTheme}
              isDark={isDark}
              radius={radius}
              onThemeChange={changeTheme}
              onDarkToggle={toggleDark}
              onRadiusChange={changeRadius}
              onImportClick={() => setImportOpen(true)}
            />
          ) : (
            <LayoutTab collapsed={collapsed} onCollapsedChange={setCollapsed} />
          )}
        </div>
      </aside>

      <ImportModal open={importOpen} onOpenChange={setImportOpen} onImport={handleImport} />

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── Theme Tab ─────────────────────────────────────────────────────────────────

function ThemeTab({
  selectedTheme,
  isDark,
  radius,
  onThemeChange,
  onDarkToggle,
  onRadiusChange,
  onImportClick,
}: {
  selectedTheme: string;
  isDark: boolean;
  radius: string;
  onThemeChange: (v: string) => void;
  onDarkToggle: (v: boolean) => void;
  onRadiusChange: (v: string) => void;
  onImportClick: () => void;
}) {
  return (
    <div className="p-4 space-y-6">

      {/* Color Presets */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider admin-text-subtle">Accent Color</p>
        <div className="grid grid-cols-4 gap-2">
          {THEME_PRESETS.map((preset) => {
            const swatch = isDark ? preset.dark['--admin-primary'] : preset.light['--admin-primary'];
            const active = selectedTheme === preset.value;
            return (
              <button
                key={preset.value}
                onClick={() => onThemeChange(preset.value)}
                title={preset.name}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-all admin-border-color',
                  active
                    ? 'admin-surface-raised'
                    : 'admin-hover',
                )}
              >
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: swatch }}
                >
                  {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                <span className="text-[10px] admin-text-subtle leading-none truncate w-full text-center">
                  {preset.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <hr className="admin-border-color" />

      {/* Mode */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider admin-text-subtle">Mode</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onDarkToggle(false)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-medium transition-all',
              !isDark
                ? 'admin-accent-border-dim admin-accent-bg-dim admin-accent-text'
                : 'admin-border-color admin-text-subtle admin-hover',
            )}
          >
            <Sun className="h-3.5 w-3.5" />
            Light
          </button>
          <button
            onClick={() => onDarkToggle(true)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-medium transition-all',
              isDark
                ? 'admin-accent-border-dim admin-accent-bg-dim admin-accent-text'
                : 'admin-border-color admin-text-subtle admin-hover',
            )}
          >
            <Moon className="h-3.5 w-3.5" />
            Dark
          </button>
        </div>
      </section>

      <hr className="admin-border-color" />

      {/* Radius */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider admin-text-subtle">Border Radius</p>
        <div className="grid grid-cols-5 gap-1.5">
          {RADIUS_OPTIONS.map((opt) => {
            const active = radius === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onRadiusChange(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border py-2 transition-all',
                  active
                    ? 'admin-accent-border-dim admin-accent-bg-dim admin-accent-text'
                    : 'admin-border-color admin-text-subtle admin-hover',
                )}
              >
                <div
                  className="h-4 w-4 border-2 border-current"
                  style={{ borderRadius: opt.value === '9999px' ? '9999px' : opt.value }}
                />
                <span className="text-[10px] font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <hr className="admin-border-color" />

      {/* Import */}
      <section>
        <button
          onClick={onImportClick}
          className="flex w-full items-center justify-center gap-2 rounded-lg border admin-border-color admin-surface-raised py-2.5 text-xs font-medium admin-text-muted admin-hover transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Import Custom CSS
        </button>
      </section>
    </div>
  );
}

// ── Layout Tab ────────────────────────────────────────────────────────────────

function LayoutTab({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
}) {
  return (
    <div className="p-4 space-y-6">

      {/* Sidebar state */}
      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider admin-text-subtle">Sidebar</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Expanded', value: false },
            { label: 'Collapsed', value: true },
          ].map((opt) => {
            const active = collapsed === opt.value;
            return (
              <button
                key={String(opt.value)}
                onClick={() => onCollapsedChange(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-3 transition-all admin-border-color',
                  active
                    ? 'admin-accent-border-dim admin-accent-bg-dim'
                    : 'admin-hover',
                )}
              >
                {/* Mini sidebar preview */}
                <div className="flex h-10 w-full rounded-md border admin-border-color overflow-hidden admin-surface-raised">
                  <div className={cn('admin-bg flex-shrink-0 border-r admin-border-color', opt.value ? 'w-3' : 'w-7')} />
                  <div className="flex-1 admin-surface" />
                </div>
                <span className={cn('text-xs font-medium', active ? 'admin-accent-text' : 'admin-text-subtle')}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <hr className="admin-border-color" />

      {/* Info */}
      <section className="rounded-lg border admin-border-color admin-surface-raised p-4 space-y-2">
        <p className="text-xs font-semibold admin-text-color">About this panel</p>
        <p className="text-[11px] admin-text-subtle leading-relaxed">
          Changes to the accent color and radius are applied as CSS custom properties and persisted to localStorage. Import CSS to apply full shadcn-compatible themes.
        </p>
      </section>
    </div>
  );
}
