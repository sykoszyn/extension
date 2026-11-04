/**
 * Content script for www.faceit.com.
 *
 * - Renders inside a Shadow DOM so FACEIT's styles and ours never mix
 *   and FACEIT's own DOM is left untouched (we only append one host element).
 * - FACEIT is a SPA: we watch `location.href` (cheap 700 ms poll; the isolated
 *   world cannot hook the page's history API) and swap panels on route change.
 * - No data is read from FACEIT's DOM except: the URL (nickname / match id)
 *   and, for Auto Accept, the visible match-found dialog.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import css from '@dash/styles.css?inline';
import { storageGet, storageSet } from '@ext/compat/browser';
import { LogoMark } from '@dash/components/Logo';
import { PlayerOverview } from '@dash/components/PlayerOverview';
import { PvpPanel } from '@dash/components/PvpPanel';
import { LobbyView } from '@dash/components/LobbyView';
import { Notice, Segmented, cx } from '@dash/components/ui';
import { useRpc } from '@dash/hooks/useRpc';
import { useSettings } from '@dash/hooks/useSettings';
import { rpc } from '@shared/rpc';
import { parseFaceitPath, type FaceitRoute } from '@shared/utils/faceit-url';
import { AcceptOverlay } from './AcceptOverlay';

function useFaceitRoute(): FaceitRoute {
  const [route, setRoute] = useState(() => parseFaceitPath(location.pathname));
  useEffect(() => {
    let last = location.href;
    const t = setInterval(() => {
      if (location.href === last) return;
      last = location.href;
      setRoute(parseFaceitPath(location.pathname));
    }, 700);
    return () => clearInterval(t);
  }, []);
  return route;
}

const openDash = (hash: string) => void rpc('ui.openDashboard', { hash }).catch(() => undefined);

function Dock({ wide, title, children }: { wide?: boolean; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    storageGet<boolean>('sykos.dockOpen', true).then(setOpen);
  }, []);
  const set = (v: boolean) => {
    setOpen(v);
    void storageSet('sykos.dockOpen', v);
  };
  if (open === null) return null;
  if (!open)
    return (
      <button
        onClick={() => set(true)}
        title={`SykosTracker · ${title}`}
        className="fixed right-0 top-1/3 z-[2147483646] flex items-center gap-2 rounded-l-xl border border-r-0 border-ember-500/40 bg-ink-900 px-2.5 py-3 shadow-2xl hover:bg-ink-800"
      >
        <LogoMark size={22} />
        <span className="font-display text-[11px] font-bold uppercase tracking-widest text-fog-300 [writing-mode:vertical-rl]">{title}</span>
      </button>
    );
  return (
    <aside
      className={cx(
        'st-scroll fixed bottom-3 right-3 top-[72px] z-[2147483646] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950/[0.97] shadow-[0_24px_80px_-20px_rgba(0,0,0,.9)] backdrop-blur animate-rise',
        wide ? 'w-[min(1040px,calc(100vw-24px))]' : 'w-[min(540px,calc(100vw-24px))]',
      )}
      aria-label="SykosTracker"
    >
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <LogoMark size={20} />
        <span className="font-display text-[15px] font-bold uppercase tracking-[0.08em]">
          Sykos<span className="text-ember-500">Tracker</span>
        </span>
        <span className="st-label ml-1">· {title}</span>
        <button className="ml-auto text-[12px] text-fog-400 hover:text-fog-100" onClick={() => openDash('overview')}>
          Dashboard ↗
        </button>
        <button className="ml-2 grid h-7 w-7 place-items-center rounded-md text-fog-400 hover:bg-white/5 hover:text-fog-100" onClick={() => set(false)} aria-label="Minimizar panel">
          ✕
        </button>
      </header>
      <div className="st-scroll flex-1 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}

function ProfilePanel({ nickname, myId }: { nickname: string; myId: string }) {
  const [tab, setTab] = useState<'profile' | 'pvp'>('profile');
  const other = useRpc('player.resolve', { query: nickname });
  const otherId = other.data?.id;
  const isMe = !!otherId && otherId === myId;
  return (
    <div className="space-y-3">
      {myId && !isMe && (
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: 'profile', label: 'Estadísticas' },
            { key: 'pvp', label: 'VS tú' },
          ]}
        />
      )}
      {!myId && <Notice>Vincula tu cuenta en el dashboard (Ajustes) para ver vuestro historial Player vs Player.</Notice>}
      {tab === 'profile' || !myId || isMe ? (
        <PlayerOverview
          query={nickname}
          compact
          actions={(p) => (
            <button className="st-btn-ghost !py-1" onClick={() => openDash(`history/${encodeURIComponent(p.id)}`)}>
              Historial completo ↗
            </button>
          )}
        />
      ) : otherId ? (
        <PvpPanel meId={myId} otherId={otherId} compact />
      ) : null}
    </div>
  );
}

function ContentApp() {
  const route = useFaceitRoute();
  const { settings, ready } = useSettings();

  useEffect(() => {
    if (route.kind === 'room') void storageSet('sykos.lastRoom', { matchId: route.matchId, at: Date.now() });
  }, [route]);

  if (!ready) return null;
  return (
    <>
      <AcceptOverlay settings={settings.autoAccept} />
      {route.kind === 'profile' && settings.injectProfilePanel && (
        <Dock title="Perfil">
          <ProfilePanel key={route.nickname} nickname={route.nickname} myId={settings.myPlayerId} />
        </Dock>
      )}
      {route.kind === 'room' && settings.injectLobbyPanel && (
        <Dock wide title="Lobby Analyzer">
          <LobbyView key={route.matchId} matchId={route.matchId} myPlayerId={settings.myPlayerId} onOpenPlayer={(id) => openDash(`overview/${encodeURIComponent(id)}`)} />
        </Dock>
      )}
    </>
  );
}

function mount() {
  if (document.getElementById('sykostracker-root')) return;
  const host = document.createElement('div');
  host.id = 'sykostracker-root';
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483646;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const app = document.createElement('div');
  app.className = 'st-root';
  shadow.append(style, app);
  document.documentElement.append(host);
  createRoot(app).render(
    <StrictMode>
      <ContentApp />
    </StrictMode>,
  );
}

if (document.body) mount();
else document.addEventListener('DOMContentLoaded', mount, { once: true });
