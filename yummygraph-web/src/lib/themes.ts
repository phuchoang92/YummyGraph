/**
 * Theme registry — the six mood-based variants from the design system.
 *
 * Each theme shares one token structure and is applied at runtime by setting
 * `data-theme` on <html>; the actual palette lives in CSS custom properties in
 * `index.css` (`:root[data-theme='…']`). The `swatch` is the theme's accent
 * color, used only for the picker preview dot.
 */
export const THEMES = [
  { id: 'dark', mood: 'Focused', swatch: '#00ff88' },
  { id: 'light', mood: 'Explain', swatch: '#1f8f4e' },
  { id: 'dracula', mood: 'Nervous', swatch: '#bd93f9' },
  { id: 'yummy', mood: 'Love', swatch: '#ff79c6' },
  { id: 'angry', mood: 'Angry', swatch: '#ff6644' },
  { id: 'idea', mood: 'Idea', swatch: '#ffd84d' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const THEME_IDS = THEMES.map((t) => t.id) as readonly ThemeId[];

export const DEFAULT_THEME: ThemeId = 'dark';

export const THEME_STORAGE_KEY = 'yummygraph:theme';

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);

/** Read the persisted theme, falling back to the default. SSR/test safe. */
export const getStoredTheme = (): ThemeId => {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(stored) ? stored : DEFAULT_THEME;
};

/** Apply a theme to the document root and persist it. */
export const applyTheme = (theme: ThemeId): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
};
