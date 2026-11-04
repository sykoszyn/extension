import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getURL, openTab } from '@ext/compat/browser';
import { Wordmark } from '@dash/components/Logo';
import { PlayerSearch } from '@dash/components/PlayerSearch';
import { Avatar, LevelBadge, Skeleton } from '@dash/components/ui';
import { useRpc } from '@dash/hooks/useRpc';
import { useSettings } from '@dash/hooks/useSettings';
import { Toggle } from '@dash/pages/Settings';
import { fmt } from '@shared/utils/format';
import '@dash/styles.css';

const open = (hash: string) => openTab(getURL(`dashboard/index.html#${hash}`)).then(() => window.close());

function Me({ id }: { id: string }) {
  const p = useRpc('player.resolve', { query: id });
  if (p.error) return <p className="text-[12px] text-blood-400">{p.error.message}</p>;
  if (!p.data) return <Skeleton className="h-12" />;
  return (
    <button className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-left hover:border-white/15" onClick={() => open('overview')}>
      <Avatar src={p.data.avatar} name={p.data.nickname} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{p.data.nickname}</div>
        <div className="text-[11px] text-fog-500">Abrir mi Overview</div>
      </div>
      <LevelBadge level={p.data.level} />
      <span className="st-num text-[18px] text-ember-400">{fmt(p.data.elo)}</span>
    </button>
  );
}

function Popup() {
  const { settings, ready, update } = useSettings();
  const aa = settings.autoAccept;
  return (
    <div className="st-root space-y-3 p-4">
      <div className="flex items-center justify-between">
        <Wordmark />
        <button className="text-[12px] text-fog-400 hover:text-fog-100" onClick={() => open('settings')}>
          Ajustes
        </button>
      </div>
      {ready && (settings.myPlayerId ? <Me id={settings.myPlayerId} /> : <button className="st-btn-primary w-full" onClick={() => open('settings')}>Vincular mi cuenta FACEIT</button>)}
      <PlayerSearch onSelect={(r) => open(r.kind === 'player' ? `overview/${encodeURIComponent(r.id)}` : `lobby/${encodeURIComponent(r.id)}`)} />
      <div className="grid grid-cols-2 gap-2">
        {[
          ['compare', 'Player vs Player'],
          ['history', 'Historial'],
          ['lobby', 'Lobby Analyzer'],
          ['maps', 'Mapas'],
        ].map(([h, l]) => (
          <button key={h} className="st-btn-ghost" onClick={() => open(h)}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-white/[0.06] p-2.5">
        <div>
          <div className="font-semibold">Auto Accept</div>
          <div className="text-[11px] text-fog-500">{!aa.acknowledged ? 'Lee el aviso en Ajustes para activarlo' : aa.enabled ? `Activo · ${aa.delaySeconds} s de cuenta atrás` : 'Desactivado · solo aviso'}</div>
        </div>
        {aa.acknowledged ? <Toggle label="Auto Accept" checked={aa.enabled} onChange={(v) => update({ autoAccept: { ...aa, enabled: v } })} /> : <button className="st-btn-ghost !py-1" onClick={() => open('settings')}>Configurar</button>}
      </div>
      <button className="st-btn-primary w-full" onClick={() => open('overview')}>
        Abrir dashboard
      </button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
