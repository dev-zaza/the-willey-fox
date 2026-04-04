'use client';

import { useCallback, useEffect, useState } from 'react';
import { THEME_PRESETS, type ThemePreset } from './theme-presets';

const STORAGE_KEY = 'admin-theme';
const DARK_MODE_KEY = 'admin-dark-mode';
const RADIUS_KEY = 'admin-radius';

function applyPresetVars(preset: ThemePreset, dark: boolean) {
  const root = document.documentElement;
  const vars = dark ? preset.dark : preset.light;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

function applyDarkClass(dark: boolean) {
  document.documentElement.classList.toggle('admin-dark', dark);
}

export function useThemeManager() {
  const [selectedTheme, setSelectedTheme] = useState<string>('orange');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [radius, setRadius] = useState<string>('8px');
  const [mounted, setMounted] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    const theme = localStorage.getItem(STORAGE_KEY) ?? 'orange';
    const dark = localStorage.getItem(DARK_MODE_KEY) !== 'false';
    const r = localStorage.getItem(RADIUS_KEY) ?? '8px';
    setSelectedTheme(theme);
    setIsDark(dark);
    setRadius(r);

    const preset = THEME_PRESETS.find((p) => p.value === theme) ?? THEME_PRESETS[0];
    applyPresetVars(preset, dark);
    applyDarkClass(dark);
    document.documentElement.style.setProperty('--admin-radius', r);
    setMounted(true);
  }, []);

  const applyTheme = useCallback((value: string, dark: boolean) => {
    const preset = THEME_PRESETS.find((p) => p.value === value) ?? THEME_PRESETS[0];
    applyPresetVars(preset, dark);
    localStorage.setItem(STORAGE_KEY, value);
  }, []);

  const toggleDark = useCallback((dark: boolean) => {
    applyDarkClass(dark);
    setIsDark(dark);
    localStorage.setItem(DARK_MODE_KEY, String(dark));
    // Re-apply current theme for the new mode
    const theme = localStorage.getItem(STORAGE_KEY) ?? 'orange';
    const preset = THEME_PRESETS.find((p) => p.value === theme) ?? THEME_PRESETS[0];
    applyPresetVars(preset, dark);
  }, []);

  const changeTheme = useCallback((value: string) => {
    setSelectedTheme(value);
    applyTheme(value, isDark);
  }, [applyTheme, isDark]);

  const changeRadius = useCallback((r: string) => {
    setRadius(r);
    document.documentElement.style.setProperty('--admin-radius', r);
    localStorage.setItem(RADIUS_KEY, r);
  }, []);

  const reset = useCallback(() => {
    const preset = THEME_PRESETS[0];
    setSelectedTheme('orange');
    setIsDark(true);
    setRadius('8px');
    applyPresetVars(preset, true);
    applyDarkClass(true);
    document.documentElement.style.setProperty('--admin-radius', '8px');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DARK_MODE_KEY);
    localStorage.removeItem(RADIUS_KEY);
  }, []);

  return { selectedTheme, isDark, radius, mounted, changeTheme, toggleDark, changeRadius, reset };
}
