/**
 * Popup — deliberately minimal:
 *   1. not linked → "Tu nickname de FACEIT" + Guardar
 *   2. linked     → one compact profile card (ELO, win rate, K/D, last 5)
 *   3. Auto-aceptar partidas switch
 *   4. links: Análisis completo · Ajustes · creator links (sykos.config.json)
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getURL, openTab } from '@ext/compat/browser';
import { LogoMark } from '@dash/components/Logo';
import { AutoAcceptSwitch, LanguageSelect, NicknameForm } from '@dash/components/Simple';
import { useLang } from '@dash/hooks/useLang';
import { t } from '@shared/i18n';
import { CreatorLinks } from '@dash/components/CreatorLinks';
import { Avatar, ErrorBox, LevelBadge, ResultChip, Skeleton } from '@dash/components/ui';
import { useRpc } from '@dash/hooks/useRpc';
import { useSettings } from '@dash/hooks/useSettings';
import type { Settings } from '@shared/types/settings';
import { fmt, pct, ratio } from '@shared/utils/format';
import { todaySession } from '@shared/utils/encounters';
import { LevelBar } from '@dash/components/LevelBar';
import '@dash/styles.css';

const open = (hash: string) => openTab(getURL(`dashboard/index.html#${hash}`)).then(() => window.close());

function ProfileCard({ id, onChange }: { id: string; onChange: () => void }) {
  const p = useRpc('player.resolve', { query: id });
  const life = useRpc('player.lifetime', { id });
  // 20 = same cached request as the profile panel; the chips show the last 5.
  const recent = useRpc('player.recent', { id, limit: 20 });
  const err = p.error ?? life.error;
  if (err) return <ErrorBox error={err} onRetry={() => p.reload()} />;
  if (!p.data) return <Skeleton className="h-[104px]" />;
  const today = todaySession(recent.data ?? []);
  return (
    <div className="st-card st-glow overflow-hidden p-3">
      <div className="flex items-center gap-3">
        <Avatar src={p.data.avatar} name={p.data.nickname} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[17px] font-bold uppercase leading-tight tracking-wide">{p.data.nickname}</div>
          <button className="text-[11px] text-fog-500 hover:text-ember-400" onClick={onChange}>
            {t('nick.change')}
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
        <span className="flex gap-0.5" title={t('lastN', { n: 5 })}>
          {(recent.data ?? []).slice(0, 5).map((l) => (
            <ResultChip key={l.matchId} win={l.win} />
          ))}
        </span>
      </div>
      <LevelBar elo={p.data.elo} className="mt-2.5" />
      {today.matches > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-white/[0.03] px-2 py-1.5 text-[12px]">
          <span className="text-fog-400">{t('today')}</span>
          <span>
            <b className="text-win">{today.wins}{t('w')}</b> <span className="text-fog-500">·</span> <b className="text-loss">{today.losses}{t('l')}</b>
            <span className="text-fog-500"> · K/D </span>
            <b className="text-fog-100">{ratio(today.kd)}</b>
          </span>
        </div>
      )}
    </div>
  );
}

function Popup() {
  const { settings, ready, update } = useSettings();
  const [editing, setEditing] = useState(false);
  const up = (p: Partial<Settings>) => update(p);
  const lang = useLang(settings.language);

  return (
    <div key={lang} className="st-root w-[320px] space-y-4 p-4">
      <header>
        <div className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="font-display text-[18px] font-bold uppercase tracking-[0.06em]">
            Sykos<span className="text-ember-500">Tracker</span>
          </span>
        </div>
        <div className="mt-1 flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[12px] text-fog-500">{t('popup.tagline')}</p>
          <LanguageSelect settings={settings} update={up} className="!w-[92px] shrink-0 !px-1.5 !py-0.5 !text-[11px]" />
        </div>
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
          {t('popup.full')} →
        </button>
        <button className="text-fog-400 hover:text-fog-100" onClick={() => open('settings')}>
          {t('nav.settings')}
        </button>
      </footer>
      <CreatorLinks compact />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
