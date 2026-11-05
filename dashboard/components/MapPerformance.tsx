import { useState } from 'react';
import type { LifetimeStats, MatchStatLine } from '@shared/types/faceit';
import { formSummary, mapWindowStats } from '@shared/utils/analytics';
import { fmt, pct, ratio } from '@shared/utils/format';
import { mapLabel } from '@shared/utils/maps';
import type { MapWindowStats } from '@shared/types/analytics';
import { Empty, MapBadge, Segmented, cx } from './ui';
import { t } from '@shared/i18n';

export type WindowKey = '5' | '10' | '20' | '50' | '100';

export function MapCard({ m, title, lifetimeWr }: { m: MapWindowStats; title?: string; lifetimeWr?: number | null }) {
  const s = m.currentStreak;
  return (
    <div className="st-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/[0.05] p-3">
        <MapBadge map={m.map} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[15px] font-bold uppercase tracking-wide">{title ?? mapLabel(m.map)}</div>
          <div className="text-[11px] text-fog-500">
            {t('nMatches', { n: m.matches })} · {t('wl', { w: m.wins, l: m.losses })}
          </div>
        </div>
        <div className={cx('st-num text-[22px]', m.winRate === null ? 'text-fog-500' : m.winRate >= 50 ? 'text-win' : 'text-loss')}>{pct(m.winRate)}</div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-white/[0.04] text-center">
        {[
          ['K/D', ratio(m.kd)],
          ['ADR', fmt(m.adr, 1)],
          ['HS%', pct(m.hsPercent)],
        ].map(([k, v]) => (
          <div key={k} className="bg-ink-900 px-2 py-2">
            <div className="st-label">{k}</div>
            <div className="st-num text-[16px]">{v}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-fog-400">
        <span>
          {t('stat.streak')}:{' '}
          <b className={s.type === 'win' ? 'text-win' : s.type === 'loss' ? 'text-loss' : ''}>{s.type ? `${s.length}${s.type === 'win' ? t('w') : t('l')}` : '—'}</b>
        </span>
        <span>
          {t('max')} {m.longestWinStreak}{t('w')} / {m.longestLossStreak}{t('l')}
        </span>
        {lifetimeWr !== undefined && <span>Lifetime: {pct(lifetimeWr)}</span>}
      </div>
    </div>
  );
}

/** Map performance over selectable windows of recent matches + lifetime comparison. */
export function MapPerformance({ lines, lifetime, windows = ['5', '10', '20'] }: { lines: MatchStatLine[]; lifetime?: LifetimeStats | null; windows?: WindowKey[] }) {
  const [win, setWin] = useState<WindowKey>(windows[windows.length - 1]);
  const slice = lines.slice(0, Number(win));
  const maps = mapWindowStats(slice);
  const form = formSummary(slice);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={win} onChange={setWin} options={windows.map((w) => ({ key: w, label: t('lastN', { n: w }) }))} />
        <span className="text-[12px] text-fog-400">
          {t('nMatches', { n: slice.length })} · WR {pct(form.winRate)} · K/D {ratio(form.kd)} · ADR {fmt(form.adr, 1)}
        </span>
      </div>
      {slice.length < Number(win) && <p className="text-[11px] text-fog-500">{t('maps.onlyN', { n: slice.length })}</p>}
      {maps.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {maps.map((m) => (
            <MapCard key={m.map} m={m} lifetimeWr={lifetime ? lifetime.maps.find((x) => x.map === m.map)?.winRate ?? null : undefined} />
          ))}
        </div>
      ) : (
        <Empty title={t('maps.noneInWindow')} />
      )}
    </div>
  );
}
