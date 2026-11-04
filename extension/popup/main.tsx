import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getURL, openTab } from '@ext/compat/browser';
import { Wordmark } from '@dash/components/Logo';
import { PlayerSearch } from '@dash/components/PlayerSearch';
import { Avatar, ErrorBox, LevelBadge, MapBadge, ResultChip, Skeleton } from '@dash/components/ui';
import { useRpc } from '@dash/hooks/useRpc';
import { useSettings } from '@dash/hooks/useSettings';
import { Toggle } from '@dash/pages/Settings';
import { fmt, pct, ratio, relative } from '@shared/utils/format';
import { formSummary } from '@shared/utils/analytics';
import { matchUrl } from '@shared/utils/parse';
import '@dash/styles.css';

const open = (hash: string) => openTab(getURL(`dashboard/index.html#${hash}`)).then(() => window.close());

function Me({ id }: { id: string }) {
  const p = useRpc('player.resolve', { query: id });
  const life = useRpc('player.lifetime', { id });
  const recent = useRpc('player.recent', { id, limit: 20 });
  const err = p.error ?? life.error ?? recent.error;
  if (err) return <ErrorBox error={err} />;
  if (!p.data) return <Skeleton className="h-28" />;
  const lines = recent.data ?? [];
  const form = formSummary(lines);
  return (
    <div className="space-y-2">
      <div className="st-card st-glow overflow-hidden p-3">
        <div className="flex items-center gap-3">
          <Avatar src={p.data.avatar} name={p.data.nickname} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[18px] font-bold uppercase leading-none tracking-wide">{p.data.nickname}</div>
            <div className="mt-1 text-[11px] text-fog-500">{p.data.region ?? ''}</div>
          </div>
          <LevelBadge level={p.data.level} size={30} />
          <div className="text-right">
            <div className="st-label">ELO</div>
            <div className="st-num text-[22px] leading-none text-ember-400">{fmt(p.data.elo)}</div>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
          {[
            ['Win rate', pct(life.data?.winRate)],
            ['K/D', ratio(life.data?.kd)],
            ['Forma 20', pct(form.winRate)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-white/[0.03] py-1.5">
              <div className="st-label !text-[10px]">{k}</div>
              <div className="st-num text-[15px]">{life.data || k === 'Forma 20' ? v : '…'}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="st-card p-2">
        <div className="st-label px-1 pb-1">Últimas partidas</div>
        {recent.loading && !lines.length ? (
          <Skeleton className="h-24" />
        ) : lines.length ? (
          <ul>
            {lines.slice(0, 5).map((l) => (
              <li key={l.matchId}>
                <a className="flex items-center gap-2 rounded-md px-1 py-1 text-[12px] hover:bg-white/[0.04]" href={matchUrl(l.matchId)} target="_blank" rel="noreferrer" title="VER PARTIDA en FACEIT">
                  <ResultChip win={l.win} />
                  <MapBadge map={l.map} size="sm" />
                  <span className="st-num w-14 text-fog-400">{l.score ?? '—'}</span>
                  <span className="st-num flex-1">K/D {ratio(l.kd)}</span>
                  <span className="text-[11px] text-fog-500">{relative(l.finishedAt)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-[12px] text-fog-500">Sin partidas recientes.</p>
        )}
      </div>
    </div>
  );
}

function Popup() {
  const { settings, ready, update } = useSettings();
  const aa = settings.autoAccept;
  return (
    <div className="st-root space-y-2.5 p-3">
      <div className="flex items-center justify-between">
        <Wordmark />
        <span className="text-[10px] uppercase tracking-widest text-fog-500">CS2 · FACEIT</span>
      </div>
      {ready && (settings.myPlayerId ? <Me id={settings.myPlayerId} /> : <button className="st-btn-primary w-full" onClick={() => open('settings')}>Vincular mi cuenta FACEIT</button>)}
      <PlayerSearch onSelect={(r) => open(r.kind === 'player' ? `overview/${encodeURIComponent(r.id)}` : `lobby/${encodeURIComponent(r.id)}`)} />
      <div className="flex items-center justify-between rounded-lg border border-white/[0.06] p-2.5">
        <div>
          <div className="font-semibold">Auto Accept</div>
          <div className="text-[11px] text-fog-500">{!aa.acknowledged ? 'Lee el aviso en Configuración para activarlo' : aa.enabled ? `Activo · ${aa.delaySeconds} s de cuenta atrás` : 'Desactivado · solo aviso'}</div>
        </div>
        {aa.acknowledged ? <Toggle label="Auto Accept" checked={aa.enabled} onChange={(v) => update({ autoAccept: { ...aa, enabled: v } })} /> : <button className="st-btn-ghost !py-1" onClick={() => open('settings')}>Configurar</button>}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button className="st-btn-primary" onClick={() => open('overview')}>
          Análisis completo
        </button>
        <button className="st-btn-ghost" onClick={() => open('settings')} aria-label="Configuración">
          Configuración
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
