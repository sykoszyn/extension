import type { ReactNode } from 'react';
import { Wordmark } from './components/Logo';
import { PlayerSearch } from './components/PlayerSearch';
import { Avatar, cx } from './components/ui';
import { href, navigate, useHashRoute, type Page } from './hooks/useHashRoute';
import { useSettings } from './hooks/useSettings';
import { ComparePage, FavoritesPage, HistoryPage, LobbyPage, MapsPage, OverviewPage, SettingsPage } from './pages';

const NAV: { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'overview', label: 'Overview', icon: <path d="M4 13h6V4H4zm10 7h6V4h-6zM4 20h6v-4H4z" /> },
  { page: 'compare', label: 'Player Comparison', icon: <path d="M7 4v16M17 4v16M3 8h8M13 16h8" /> },
  { page: 'history', label: 'Match History', icon: <path d="M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /> },
  { page: 'lobby', label: 'Lobby Analyzer', icon: <path d="M3 7h7v10H3zM14 7h7v10h-7zM10 12h4" /> },
  { page: 'maps', label: 'Map Statistics', icon: <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" /> },
  { page: 'favorites', label: 'Favorites', icon: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" /> },
  { page: 'settings', label: 'Settings', icon: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /> },
];

const TITLES: Record<Page, string> = {
  overview: 'Overview',
  compare: 'Player Comparison',
  history: 'Match History',
  lobby: 'Lobby Analyzer',
  maps: 'Map Statistics',
  favorites: 'Favorites',
  settings: 'Settings',
};

export function App() {
  const route = useHashRoute();
  const { settings, ready, update } = useSettings();

  const body = !ready ? null : (() => {
    switch (route.page) {
      case 'overview':
        return <OverviewPage arg={route.arg} settings={settings} />;
      case 'compare':
        return <ComparePage arg={route.arg} settings={settings} />;
      case 'history':
        return <HistoryPage arg={route.arg} settings={settings} />;
      case 'lobby':
        return <LobbyPage arg={route.arg} settings={settings} />;
      case 'maps':
        return <MapsPage arg={route.arg} settings={settings} />;
      case 'favorites':
        return <FavoritesPage settings={settings} />;
      case 'settings':
        return <SettingsPage settings={settings} update={async (p) => void (await update(p))} />;
    }
  })();

  return (
    <div className="st-root flex min-h-screen bg-ink-950">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/[0.05] bg-ink-900/60 px-3 py-5 md:flex">
        <a href={href('overview')} className="px-2">
          <Wordmark />
        </a>
        <nav className="mt-8 space-y-0.5" aria-label="Secciones">
          {NAV.map((n) => (
            <a
              key={n.page}
              href={href(n.page)}
              aria-current={route.page === n.page ? 'page' : undefined}
              className={cx(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition',
                route.page === n.page ? 'bg-ember-500/10 text-fog-100 shadow-[inset_2px_0_0_#ff6a1f]' : 'text-fog-400 hover:bg-white/[0.03] hover:text-fog-100',
              )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={route.page === n.page ? 'text-ember-500' : ''} aria-hidden>
                {n.icon}
              </svg>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-white/[0.05] p-3 text-[11px] text-fog-500">
          {settings.myPlayerId ? (
            <button className="flex w-full items-center gap-2 text-left" onClick={() => navigate('overview')}>
              <Avatar src={null} name={settings.myNickname} size={24} />
              <span className="truncate font-semibold text-fog-300">{settings.myNickname}</span>
            </button>
          ) : (
            <a href={href('settings')} className="text-ember-400">
              Vincula tu cuenta →
            </a>
          )}
          <p className="mt-2">Datos: FACEIT Data API. SykosTracker no está afiliado a FACEIT.</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-ink-950/85 backdrop-blur">
          <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3 md:px-6">
            <div className="md:hidden">
              <Wordmark />
            </div>
            <h1 className="hidden font-display text-[22px] font-bold uppercase tracking-wide md:block">{TITLES[route.page]}</h1>
            <div className="ml-auto w-full max-w-md">
              <PlayerSearch onSelect={(r) => (r.kind === 'player' ? navigate('overview', r.id) : navigate('lobby', r.id))} />
            </div>
          </div>
          <nav className="st-scroll flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Secciones">
            {NAV.map((n) => (
              <a key={n.page} href={href(n.page)} className={cx('whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-semibold', route.page === n.page ? 'bg-ember-500 text-ink-950' : 'text-fog-400')}>
                {n.label}
              </a>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-[1280px] px-4 py-5 md:px-6">{body}</main>
      </div>
    </div>
  );
}
