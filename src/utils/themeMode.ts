import { useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'color-scheme';

function readStoredPreference(): ThemePreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
  } catch {
    // Ignore storage access errors
  }
  return 'system';
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyMetaScheme(pref: ThemePreference): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = pref === 'system' ? 'light dark' : pref;
  }
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  } catch {
    // Theme still applies even if storage is unavailable
  }
  applyMetaScheme(pref);
  window.dispatchEvent(new CustomEvent('daydot-theme-change', { detail: pref }));
}

export function useThemeMode() {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    readStoredPreference(),
  );
  const [systemDark, setSystemDark] = useState<boolean>(() => getSystemDark());

  useEffect(() => {
    applyMetaScheme(preference);
  }, [preference]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        const next = readStoredPreference();
        setPreference(next);
        applyMetaScheme(next);
      }
    };
    const handleLocalEvent = (e: Event) => {
      const next = (e as CustomEvent<ThemePreference>).detail;
      setPreference(next);
    };

    mq.addEventListener('change', handleMediaChange);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('daydot-theme-change', handleLocalEvent);
    return () => {
      mq.removeEventListener('change', handleMediaChange);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('daydot-theme-change', handleLocalEvent);
    };
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && systemDark);

  return {
    preference,
    systemDark,
    isDark,
    setPreference: (next: ThemePreference) => {
      setThemePreference(next);
    },
  };
}
