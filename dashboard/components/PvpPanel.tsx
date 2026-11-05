import { useMemo, useState } from 'react';
import { RESULT_FILTERS, type PeriodKey } from '@shared/constants';
import { t } from '@shared/i18n';
import type { LifetimeStats, PlayerProfile } from '@shared/types/faceit';
import { formSummary } from '@shared/utils/analytics';
import { date, fmt, pct, ratio } from '@shared/utils/format';
import { mapLabel } from '@shared/utils/maps';
import { useRpc } from '../hooks/useRpc';
import { Avatar, Card, Empty, ErrorBox, LevelBadge, MapBadge, Notice, ResultChip, Segmented, Skeleton, SkeletonGrid, Spinner, StatTile, VersusBar, cx } from './ui';
import { SERIES } from '../charts';

function Side({ p, align }: { p: PlayerProfile; align: 'left' | 'right' }) {
  return (
    <div className={cx('flex min-w-0 items-center gap-3', align === 'right' && 'flex-row-reverse text-right')}>
      <Avatar src={p.avatar} name={p.nickname} size={48} />
      <div className="min-w-0">
        <div className="truncate font-display text-[22px] font-bold uppercase leading-none tracking-wide">{p.nickname}</div>
        <div className={cx('mt-1 flex items-center gap-2 text-[12px] text-fog-400', align === 'right' && 'justify-end')}>
          <LevelBadge level={p.level} size={20} /> {fmt(p.elo)} ELO
        </div>
      </div>
    </div>
  );
}

function CompareTable({ me, other, meL, otherL, meRecentKd, otherRecentKd }: { me: PlayerProfile; other: PlayerProfile; meL: LifetimeStats; otherL: LifetimeStats; meRecentKd: number | null; otherRecentKd: number | null }) {
  const rows: { label: string; a: number | null; b: number | null; f: (n: number | null) => string }[] = [
    { label: t('stat.matches'), a: meL.matches, b: otherL.matches, f: (n) => fmt(n) },
    { label: t('stat.winRate'), a: meL.winRate, b: otherL.winRate, f: (n) => pct(n) },
    { label: 'K/D', a: meL.kd, b: otherL.kd, f: ratio },
    { label: t('stat.kdLast20'), a: meRecentKd, b: otherRecentKd, f: ratio },
    { label: 'ADR', a: meL.adr, b: otherL.adr, f: (n) => fmt(n, 1) },
    { label: 'HS%', a: meL.hsPercent, b: otherL.hsPercent, f: (n) => pct(n) },
    { label: 'ELO', a: me.elo, b: other.elo, f: (n) => fmt(n) },
  ];
  return (
    <table className="st-table w-full text-[13px]">
      <thead>
        <tr>
          <th />
          <th className="!text-right" style={{ color: SERIES.you }}>
            {me.nickname}
          </th>
          <th className="w-[30%]" />
          <th style={{ color: SERIES.them }}>{other.nickname}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const aBetter = r.a !== null && r.b !== null && r.a > r.b;
          const bBetter = r.a !== null && r.b !== null && r.b > r.a;
          return (
            <tr key={r.label}>
              <td className="text-fog-400">{r.label}</td>
              <td className={cx('st-num text-right text-[15px]', aBetter ? 'text-fog-100' : 'text-fog-400')}>{r.f(r.a)}</td>
              <td>
                <VersusBar a={r.a} b={r.b} />
              </td>
              <td className={cx('st-num text-[15px]', bBetter ? 'text-fog-100' : 'text-fog-400')}>{r.f(r.b)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Player vs Player: shared matches, teammates vs enemies, head-to-head record. */
export function PvpPanel({ meId, otherId, compact }: { meId: string; otherId: string; compact?: boolean }) {
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [relFilter, setRelFilter] = useState<'all' | 'enemy' | 'teammate'>('all');
  const since = useMemo(() => {
    const f = RESULT_FILTERS.find((x) => x.key === period)!;
    return Number.isFinite(f.ms) ? Date.now() - f.ms : undefined;
  }, [period]);

  const me = useRpc('player.resolve', { query: meId });
  const other = useRpc('player.resolve', { query: otherId });
  const meL = useRpc('player.lifetime', { id: meId });
  const otherL = useRpc('player.lifetime', { id: otherId });
  const meR = useRpc('player.recent', { id: meId, limit: 20 });
  const otherR = useRpc('player.recent', { id: otherId, limit: 20 });
  const pvp = useRpc('pvp.analyze', { meId, otherId, since });

  if (meId === otherId) return <Notice>{t('pvp.ownProfile')}</Notice>;

  const err = me.error ?? other.error;
  if (err) return <ErrorBox error={err} />;
  const r = pvp.data;
  const timeline = (r?.timeline ?? []).filter((x) => relFilter === 'all' || x.relation === relFilter);

  return (
    <div className="space-y-3">
      {me.data && other.data ? (
        <div className="st-card st-glow flex items-center justify-between gap-3 overflow-hidden p-4">
          <Side p={me.data} align="left" />
          <span className="shrink-0 font-display text-[26px] font-black italic tracking-tight text-ember-500">VS</span>
          <Side p={other.data} align="right" />
        </div>
      ) : (
        <Skeleton className="h-20" />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={period} onChange={setPeriod} options={RESULT_FILTERS.map((f) => ({ key: f.key, label: t(`period.${f.key}`) }))} />
        {pvp.loading && (
          <span className="flex items-center gap-2 text-[12px] text-fog-400">
            <Spinner /> {t('pvp.analyzing')}
          </span>
        )}
      </div>

      {pvp.error && <ErrorBox error={pvp.error} onRetry={() => pvp.reload()} />}

      {r && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px]">
            <span className={r.coverage.complete ? 'text-fog-400' : 'text-ember-300'}>
              {r.coverage.complete ? t('pvp.coverageComplete', { n: fmt(r.coverage.scanned) }) : t('pvp.coveragePartial', { n: fmt(r.coverage.scanned), date: date(r.coverage.oldest) })}
            </span>
            <div className="flex gap-2">
              {!r.coverage.complete && (
                <button className="st-btn-ghost !py-1" disabled={pvp.loading} onClick={() => pvp.reload({ scanOlder: true })}>
                  {t('pvp.scanOlder')}
                </button>
              )}
              {r.statsLoaded < r.timeline.length && (
                <button className="st-btn-ghost !py-1" disabled={pvp.loading} onClick={() => pvp.reload({ loadStats: true })}>
                  {t('pvp.loadMoreStats', { a: r.statsLoaded, b: r.timeline.length })}
                </button>
              )}
            </div>
          </div>

          {r.shared.count === 0 ? (
            <Empty title={t('pvp.noShared')} body={r.coverage.complete ? t('pvp.noSharedComplete') : t('pvp.noSharedPartial')} />
          ) : (
            <>
              <div className={cx('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4')}>
                <StatTile label={t('pvp.shared')} value={fmt(r.shared.count)} sub={t('pvp.sharedSub')} />
                <StatTile label={t('pvp.teammates')} value={fmt(r.asTeammates.count)} sub={`${t('wl', { w: r.asTeammates.wins, l: r.asTeammates.losses })} · ${pct(r.asTeammates.winRate)}`} />
                <StatTile label={t('pvp.rivals')} value={fmt(r.asEnemies.count)} tone="ember" sub={t('wl', { w: r.asEnemies.wins, l: r.asEnemies.losses })} />
                <StatTile
                  label={t('pvp.h2h')}
                  value={pct(r.asEnemies.winRate)}
                  tone={r.asEnemies.winRate === null ? undefined : r.asEnemies.winRate >= 50 ? 'up' : 'down'}
                  sub={t('pvp.h2hSub')}
                />
              </div>

              {r.asEnemies.count > 0 && (
                <Card title={t('pvp.headToHead')}>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {(
                      [
                        ['K/D', r.meVsAvg.kd, r.otherVsAvg.kd, ratio],
                        ['ADR', r.meVsAvg.adr, r.otherVsAvg.adr, (n: number | null) => fmt(n, 1)],
                        ['HS%', r.meVsAvg.hsPercent, r.otherVsAvg.hsPercent, (n: number | null) => pct(n)],
                      ] as const
                    ).map(([label, a, b, f]) => (
                      <div key={label} className="rounded-lg bg-white/[0.02] p-3">
                        <div className="st-label">{label}</div>
                        <div className="mt-1 flex items-baseline justify-center gap-2">
                          <span className="st-num text-[20px]" style={{ color: SERIES.you }}>
                            {f(a)}
                          </span>
                          <span className="text-fog-500">vs</span>
                          <span className="st-num text-[20px]" style={{ color: SERIES.them }}>
                            {f(b)}
                          </span>
                        </div>
                        <div className="mt-2">
                          <VersusBar a={a} b={b} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className={cx('grid grid-cols-[minmax(0,1fr)] gap-3', !compact && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]')}>
                <Card title={t('maps')}>
                  {r.maps.length ? (
                    <ul className="space-y-2">
                      {r.maps.map((m) => (
                        <li key={m.map} className="flex items-center gap-3">
                          <MapBadge map={m.map} size="sm" />
                          <span className="flex-1">{mapLabel(m.map)}</span>
                          <span className="text-[12px] text-fog-400">{t('pvp.mapCounts', { vs: m.enemy, with: m.teammate })}</span>
                          {m.enemy > 0 && (
                            <span className="st-num text-[12px]">
                              <span className="text-win">{m.enemyWins}</span>-<span className="text-loss">{m.enemyLosses}</span>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-fog-500">{t('pvp.mapsNeedStats')}</p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-fog-400">
                    <div>
                      {t('pvp.lastTogether')}: <span className="text-fog-100">{date(r.lastTogether)}</span>
                    </div>
                    <div>
                      {t('pvp.lastFaced')}: <span className="text-fog-100">{date(r.lastFaced)}</span>
                    </div>
                  </div>
                </Card>

                <Card
                  title={t('pvp.timeline')}
                  pad={false}
                  right={
                    <Segmented
                      value={relFilter}
                      onChange={setRelFilter}
                      options={[
                        { key: 'all', label: t('all') },
                        { key: 'enemy', label: t('pvp.rivals') },
                        { key: 'teammate', label: t('pvp.teammates') },
                      ]}
                    />
                  }
                >
                  <div className="st-scroll max-h-[360px] overflow-auto">
                    <table className="st-table w-full text-[12px]">
                      <thead className="sticky top-0 bg-ink-900">
                        <tr>
                          <th>{t('col.date')}</th>
                          <th>{t('col.role')}</th>
                          <th>{t('col.map')}</th>
                          <th>{t('col.result')}</th>
                          <th className="!text-right">{t('col.myKd')}</th>
                          <th className="!text-right">{t('col.theirKd')}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {timeline.map((x) => (
                          <tr key={x.matchId} className="hover:bg-white/[0.02]">
                            <td>{date(x.startedAt)}</td>
                            <td>
                              <span className={cx('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', x.relation === 'enemy' ? 'bg-ember-500/15 text-ember-300' : 'bg-white/5 text-fog-300')}>
                                {x.relation === 'enemy' ? t('rival') : t('teammate')}
                              </span>
                            </td>
                            <td>{x.map ? mapLabel(x.map) : '—'}</td>
                            <td>
                              <span className="flex items-center gap-1.5">
                                <ResultChip win={x.myWin} />
                                <span className="text-fog-500">{x.score ?? ''}</span>
                              </span>
                            </td>
                            <td className="text-right">{ratio(x.me?.kd)}</td>
                            <td className="text-right">{ratio(x.other?.kd)}</td>
                            <td className="text-right">
                              <a className="st-btn-ghost !px-2 !py-0.5 text-[11px]" href={x.faceitUrl} target="_blank" rel="noreferrer">
                                {t('viewMatch')}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      )}
      {!r && !pvp.error && <SkeletonGrid n={4} />}

      {me.data && other.data && meL.data && otherL.data && (
        <Card title={t('pvp.profiles')} pad={false}>
          <CompareTable
            me={me.data}
            other={other.data}
            meL={meL.data}
            otherL={otherL.data}
            meRecentKd={meR.data ? formSummary(meR.data).kd : null}
            otherRecentKd={otherR.data ? formSummary(otherR.data).kd : null}
          />
        </Card>
      )}
    </div>
  );
}
