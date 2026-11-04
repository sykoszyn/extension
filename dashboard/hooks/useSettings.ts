import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { getFavorites, getSettings, toggleFavorite, updateSettings, watchFavorites, watchSettings } from '@shared/settings';
import type { FavoritePlayer, Settings } from '@shared/types/settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setReady(true);
    });
    return watchSettings(setSettings);
  }, []);
  return { settings, ready, update: (p: Partial<Settings>) => updateSettings(p).then(setSettings) };
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoritePlayer[]>([]);
  useEffect(() => {
    getFavorites().then(setFavorites);
    return watchFavorites(setFavorites);
  }, []);
  return {
    favorites,
    isFavorite: (id: string) => favorites.some((f) => f.id === id),
    toggle: (p: Omit<FavoritePlayer, 'addedAt'>) => toggleFavorite(p).then(setFavorites),
  };
}
