export interface ThemePreset {
  name: string;
  value: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

// These map to the CSS variables used in the admin panel (zinc-based).
// Each preset overrides accent/brand colors while keeping the zinc base structure.
export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Orange (Default)',
    value: 'orange',
    light: { '--admin-primary': '#ea580c', '--admin-primary-dim': 'rgba(234,88,12,0.12)', '--admin-ring': '#f97316' },
    dark: { '--admin-primary': '#f97316', '--admin-primary-dim': 'rgba(249,115,22,0.15)', '--admin-ring': '#fb923c' },
  },
  {
    name: 'Blue',
    value: 'blue',
    light: { '--admin-primary': '#2563eb', '--admin-primary-dim': 'rgba(37,99,235,0.12)', '--admin-ring': '#3b82f6' },
    dark: { '--admin-primary': '#3b82f6', '--admin-primary-dim': 'rgba(59,130,246,0.15)', '--admin-ring': '#60a5fa' },
  },
  {
    name: 'Violet',
    value: 'violet',
    light: { '--admin-primary': '#7c3aed', '--admin-primary-dim': 'rgba(124,58,237,0.12)', '--admin-ring': '#8b5cf6' },
    dark: { '--admin-primary': '#8b5cf6', '--admin-primary-dim': 'rgba(139,92,246,0.15)', '--admin-ring': '#a78bfa' },
  },
  {
    name: 'Emerald',
    value: 'emerald',
    light: { '--admin-primary': '#059669', '--admin-primary-dim': 'rgba(5,150,105,0.12)', '--admin-ring': '#10b981' },
    dark: { '--admin-primary': '#10b981', '--admin-primary-dim': 'rgba(16,185,129,0.15)', '--admin-ring': '#34d399' },
  },
  {
    name: 'Rose',
    value: 'rose',
    light: { '--admin-primary': '#e11d48', '--admin-primary-dim': 'rgba(225,29,72,0.12)', '--admin-ring': '#f43f5e' },
    dark: { '--admin-primary': '#f43f5e', '--admin-primary-dim': 'rgba(244,63,94,0.15)', '--admin-ring': '#fb7185' },
  },
  {
    name: 'Amber',
    value: 'amber',
    light: { '--admin-primary': '#d97706', '--admin-primary-dim': 'rgba(217,119,6,0.12)', '--admin-ring': '#f59e0b' },
    dark: { '--admin-primary': '#f59e0b', '--admin-primary-dim': 'rgba(245,158,11,0.15)', '--admin-ring': '#fbbf24' },
  },
  {
    name: 'Cyan',
    value: 'cyan',
    light: { '--admin-primary': '#0891b2', '--admin-primary-dim': 'rgba(8,145,178,0.12)', '--admin-ring': '#06b6d4' },
    dark: { '--admin-primary': '#06b6d4', '--admin-primary-dim': 'rgba(6,182,212,0.15)', '--admin-ring': '#22d3ee' },
  },
  {
    name: 'Pink',
    value: 'pink',
    light: { '--admin-primary': '#db2777', '--admin-primary-dim': 'rgba(219,39,119,0.12)', '--admin-ring': '#ec4899' },
    dark: { '--admin-primary': '#ec4899', '--admin-primary-dim': 'rgba(236,72,153,0.15)', '--admin-ring': '#f472b6' },
  },
];

export const RADIUS_OPTIONS = [
  { label: '0', value: '0px' },
  { label: 'sm', value: '4px' },
  { label: 'md', value: '8px' },
  { label: 'lg', value: '12px' },
  { label: 'full', value: '9999px' },
];
