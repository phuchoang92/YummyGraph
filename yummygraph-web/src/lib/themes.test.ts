import { describe, it, expect, beforeEach } from 'vitest';
import {
  THEMES,
  THEME_IDS,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isThemeId,
  getStoredTheme,
  applyTheme,
} from './themes';

describe('themes registry', () => {
  it('exposes the six design-system variants', () => {
    expect(THEME_IDS).toEqual(['dark', 'light', 'dracula', 'yummy', 'angry', 'idea']);
  });

  it('gives every theme a hex swatch', () => {
    for (const theme of THEMES) {
      expect(theme.swatch).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('defaults to dark', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(THEME_IDS).toContain(DEFAULT_THEME);
  });
});

describe('isThemeId', () => {
  it('accepts known ids and rejects everything else', () => {
    expect(isThemeId('dracula')).toBe(true);
    expect(isThemeId('light')).toBe(true);
    expect(isThemeId('neon')).toBe(false);
    expect(isThemeId('')).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(42)).toBe(false);
  });
});

describe('getStoredTheme / applyTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('falls back to the default when nothing is stored', () => {
    expect(getStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('ignores a corrupt stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme');
    expect(getStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('round-trips a valid theme through apply + read', () => {
    applyTheme('yummy');
    expect(document.documentElement.dataset.theme).toBe('yummy');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('yummy');
    expect(getStoredTheme()).toBe('yummy');
  });
});
