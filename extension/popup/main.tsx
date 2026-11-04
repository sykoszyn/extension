/**
 * Popup — deliberately minimal:
 *   1. not linked → "Tu nickname de FACEIT" + Guardar
 *   2. linked     → one compact profile card (ELO, win rate, K/D, last 5)
 *   3. Auto-aceptar partidas switch
 *   4. links: Análisis completo · Ajustes
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getURL, openTab } from '@ext/compat/browser';
import { LogoMark } from '@dash/components/Logo';
import { AutoAcceptSwitch, NicknameForm } from '@dash/components/Simple';
import { Avatar, ErrorBox, LevelBadge, ResultChip, Skeleton } from '@dash/components/ui';
import { useRpc } from '@dash/hooks/useRpc';
import { useSettings } from '@dash/hooks/useSettings';
import type { Settings } from '@shared/types/settings';
import { fmt, pct, ratio } from '@shared/utils/format';
import '@dash/styles.css';

const open = (hash: string) => openTab(getURL(`dashboard/index.html#${hash}`)).then(() => window.close());

function ProfileCard({ id, onChange }: { id: string; onChange: () => void }) {
  const p = useRpc('player.resolve', { query: id });
  const life = useRpc('player.lifetime', { id });
  const recent = useRpc('player.recent', { id, limit: 5 });
  const err = p.error ?? life.error;
  if (err) return <ErrorBox error={err} onRetry={() => p.reload()} />;
  if (!p.data) return <Skeleton className="h-[104px]" />;
  return (
    <div className="st-card st-glow overflow-hidden p-3">
      <div className="flex items-center gap-3">
        <Avatar src={p.data.avatar} name={p.data.nickname} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[17px] font-bold uppercase leading-tight tracking-wide">{p.data.nickname}</div>
          <button className="text-[11px] text-fog-500 hover:text-ember-400" onClick={onChange}>
            Cambiar nickname
          </button>
        </div>
        <LevelBadge level={p.data.level} size={28} />
        <div className="text-right">
          <div className="st-num text-[22px] leading-none text-ember-400">{fmt(p.data.elo)}</div>
          <div className="text-[10px] uppercase tracking-widest text-fog-500">ELO</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[12px]">
        <span className="text-fog-400">
          WR <b className="text-fog-100">{pct(life.data?.winRate)}</b>
        </span>
        <span className="text-fog-400">
          K/D <b className="text-fog-100">{ratio(life.data?.kd)}</b>
        </span>
        <span className="flex gap-0.5" title="Últimas 5 partidas">
          {(recent.data ?? []).map((l) => (
            <ResultChip key={l.matchId} win={l.win} />
          ))}
        </span>
      </div>
    </div>
  );
}

function Popup() {
  const { settings, ready, update } = useSettings();
  const [editing, setEditing] = useState(false);
  const up = (p: Partial<Settings>) => update(p);

  return (
    <div className="st-root w-[320px] space-y-4 p-4">
      <header>
        <div className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="font-display text-[18px] font-bold uppercase tracking-[0.06em]">
            Sykos<span className="text-ember-500">Tracker</span>
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-fog-500">Configúralo una vez y funciona en todos los perfiles.</p>
      </header>

      {!ready ? (
        <Skeleton className="h-[104px]" />
      ) : settings.myPlayerId && !editing ? (
        <ProfileCard id={settings.myPlayerId} onChange={() => setEditing(true)} />
      ) : (
        <NicknameForm settings={settings} update={up} autoFocus onDone={() => setEditing(false)} />
      )}

      <div className="border-t border-white/[0.06] pt-4">
        <AutoAcceptSwitch settings={settings} update={up} />
      </div>

      <footer className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[12px]">
        <button className="font-semibold text-ember-400 hover:text-ember-300" onClick={() => open('overview')}>
          Ver análisis completo →
        </button>
        <button className="text-fog-400 hover:text-fog-100" onClick={() => open('settings')}>
          Ajustes
        </button>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
