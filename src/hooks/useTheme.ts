import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'crm_theme';

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Apply saved theme before React mounts (avoids flash). */
export function initTheme(): void {
  applyTheme(readStoredTheme());
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore quota errors
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, toggleTheme };
}
