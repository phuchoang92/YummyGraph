import { describe, it, expect } from 'vitest';
import { folderKeyOf, shortLabel, formatHullLabel, rectsOverlap } from './useFolderHulls';

describe('folderKeyOf', () => {
  it('returns the directory of a file path', () => {
    expect(folderKeyOf('src/auth/login.ts')).toBe('src/auth');
    expect(folderKeyOf('a/b/c/d.ts')).toBe('a/b/c');
  });

  it('uses an empty key for repo-root files', () => {
    expect(folderKeyOf('index.ts')).toBe('');
  });

  it('returns null for an empty path', () => {
    expect(folderKeyOf('')).toBeNull();
  });
});

describe('shortLabel', () => {
  it('shows the last path segment', () => {
    expect(shortLabel('src/auth')).toBe('auth');
    expect(shortLabel('a/b/c')).toBe('c');
  });

  it('renders the repo root as a slash', () => {
    expect(shortLabel('')).toBe('/');
  });
});

describe('formatHullLabel', () => {
  it('joins name and member count', () => {
    expect(formatHullLabel('auth', 12)).toBe('auth · 12');
    expect(formatHullLabel('/', 3)).toBe('/ · 3');
  });
});

describe('rectsOverlap', () => {
  const base = { x: 0, y: 0, w: 10, h: 10 };

  it('detects overlapping rectangles', () => {
    expect(rectsOverlap(base, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });

  it('treats edge-only contact as non-overlapping', () => {
    expect(rectsOverlap(base, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
  });

  it('returns false for fully separated rectangles', () => {
    expect(rectsOverlap(base, { x: 100, y: 100, w: 5, h: 5 })).toBe(false);
  });
});
