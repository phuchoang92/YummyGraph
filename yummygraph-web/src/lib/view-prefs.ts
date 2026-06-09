/**
 * Persisted graph-view preferences (localStorage). Mirrors the storage pattern
 * used for the embeddings auto-start flag in `useAppState`.
 */
export const SHOW_HULLS_STORAGE_KEY = 'yummygraph.showHulls';

/** Whether the folder-boundary overlay was last left on. Defaults to false. */
export const getStoredShowHulls = (): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return window.localStorage.getItem(SHOW_HULLS_STORAGE_KEY) === 'true';
};

export const setStoredShowHulls = (value: boolean): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(SHOW_HULLS_STORAGE_KEY, value ? 'true' : 'false');
};
