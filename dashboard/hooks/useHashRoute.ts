import { useEffect, useState } from 'react';

export type Page = 'overview' | 'compare' | 'history' | 'lobby' | 'maps' | 'favorites' | 'settings';
export const PAGES: Page[] = ['overview', 'compare', 'history', 'lobby', 'maps', 'favorites', 'settings'];

export interface Route {
  page: Page;
  arg: string | null;
}

export function parseHash(hash: string): Route {
  const [p, ...rest] = hash.replace(/^#\/?/, '').split('/');
  const page = (PAGES as string[]).includes(p) ? (p as Page) : 'overview';
  const arg = rest.length ? decodeURIComponent(rest.join('/')) : null;
  return { page, arg: arg || null };
}

export function href(page: Page, arg?: string | null) {
  return `#${page}${arg ? `/${encodeURIComponent(arg)}` : ''}`;
}

export function navigate(page: Page, arg?: string | null) {
  location.hash = href(page, arg);
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
