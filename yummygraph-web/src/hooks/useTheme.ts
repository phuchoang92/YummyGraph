import { useCallback, useEffect, useState } from 'react';
import { applyTheme, getStoredTheme, type ThemeId } from '@/lib/themes';

/**
 * Runtime theme switching. Reads the persisted theme on mount, keeps it in sync
 * with the document root and localStorage, and reacts to changes made in other
 * tabs (storage event).
 */
export const useTheme = () => {
  const [theme, setThemeState] = useState<ThemeId>(getStoredTheme);

  // Keep <html data-theme> in sync (also covers the very first paint).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Mirror changes from other tabs/windows.
  useEffect(() => {
    const onStorage = () => {
      const next = getStoredTheme();
      setThemeState((prev) => (prev === next ? prev : next));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
  }, []);

  return { theme, setTheme };
};
