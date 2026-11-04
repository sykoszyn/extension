import { DEFAULT_SETTINGS } from './constants';
import type { FavoritePlayer, RecentSearch, Settings } from './types/settings';
import { onStorageChange, storageGet, storageSet } from '@ext/compat/browser';

const KEY = 'sykos.settings';
const FAV = 'sykos.favorites';
const RECENT = 'sykos.recent';

export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(stored ?? {}),
    autoAccept: { ...DEFAULT_SETTINGS.autoAccept, ...(stored?.autoAccept ?? {}) },
  };
}

export async function getSettings(): Promise<Settings> {
  return mergeSettings(await storageGet<Partial<Settings>>(KEY, {}));
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = mergeSettings({ ...(await getSettings()), ...patch });
  // Safety invariant: auto-accept can only be enabled after the warning was acknowledged.
  if (next.autoAccept.enabled && !next.autoAccept.acknowledged) next.autoAccept.enabled = false;
  next.autoAccept.delaySeconds = Math.max(0, Math.min(15, Math.round(next.autoAccept.delaySeconds)));
  await storageSet(KEY, next);
  return next;
}

export function watchSettings(cb: (s: Settings) => void) {
  return onStorageChange(KEY, (v) => cb(mergeSettings(v as Partial<Settings>)));
}

export async function getFavorites(): Promise<FavoritePlayer[]> {
  return storageGet<FavoritePlayer[]>(FAV, []);
}

export async function toggleFavorite(p: Omit<FavoritePlayer, 'addedAt'>): Promise<FavoritePlayer[]> {
  const list = await getFavorites();
  const next = list.some((f) => f.id === p.id) ? list.filter((f) => f.id !== p.id) : [{ ...p, addedAt: Date.now() }, ...list];
  await storageSet(FAV, next);
  return next;
}

export function watchFavorites(cb: (f: FavoritePlayer[]) => void) {
  return onStorageChange(FAV, (v) => cb((v as FavoritePlayer[]) ?? []));
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
  return storageGet<RecentSearch[]>(RECENT, []);
}

export async function pushRecentSearch(p: Omit<RecentSearch, 'at'>): Promise<void> {
  const list = (await getRecentSearches()).filter((r) => r.id !== p.id);
  await storageSet(RECENT, [{ ...p, at: Date.now() }, ...list].slice(0, 15));
}

export async function clearRecentSearches(): Promise<void> {
  await storageSet(RECENT, []);
}
