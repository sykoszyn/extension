import { useMemo, useState } from 'react';
import { RESULT_FILTERS, type PeriodKey } from '@shared/constants';
import type { LifetimeStats, PlayerProfile } from '@shared/types/faceit';
import { formSummary } from '@shared/utils/analytics';
import { date, fmt, pct, ratio, relative } from '@shared/utils/format';
import { mapLabel } from '@shared/utils/maps';
import { useRpc } from '../hooks/useRpc';
import { Avatar, Card, Empty, ErrorBox, LevelBadge, MapBadge, Notice, ResultChip, Segmented, Skeleton, SkeletonGrid, Source, Spinner, StatTile, VersusBar, cx } from './ui';
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
  const rows: { label: string; a: number | null; b: number | null; f: (n: number | null) => string; better?: 'higher' | 'lower' }[] = [
    { label: 'Partidas', a: meL.matches, b: otherL.matches, f: (n) => fmt(n) },
    { label: 'Win rate', a: meL.winRate, b: otherL.winRate, f: (n) => pct(n) },
    { label: 'K/D', a: meL.kd, b: otherL.kd, f: ratio },
    { label: 'K/D (últ. 20)', a: meRecentKd, b: otherRecentKd, f: ratio },
    { label: 'ADR', a: meL.adr, b: otherL.adr, f: (n) => fmt(n, 1) },
    { label: 'HS%', a: meL.hsPercent, b: otherL.hsPercent, f: (n) => pct(n) },
    { label: 'ELO', a: me.elo, b: other.elo, f: (n) => fmt(n) },
  ];
  return (
    <table className="st-table w-full text-[13px]">
      <thead>
        <tr>
          <th>Estadística</th>
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
              <td className={cx('st-num text-right text-[15px]', aBetter && 'text-fog-100', !aBetter && 'text-fog-400')}>{r.f(r.a)}</td>
              <td>
                <VersusBar a={r.a} b={r.b} better={r.better} />
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

  if (meId === otherId) return <Notice>Este es tu propio perfil. Abre el perfil de otro jugador para ver vuestro historial común.</Notice>;

  const err = me.error ?? other.error;
  if (err) return <ErrorBox error={err} />;
  const r = pvp.data;
  const timeline = (r?.timeline ?? []).filter((t) => relFilter === 'all' || t.relation === relFilter);

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
        <Segmented value={period} onChange={setPeriod} options={RESULT_FILTERS.map((f) => ({ key: f.key, label: f.label }))} />
        {pvp.loading && (
          <span className="flex items-center gap-2 text-[12px] text-fog-400">
            <Spinner /> Analizando historial…
          </span>
        )}
      </div>

      {pvp.error && <ErrorBox error={pvp.error} onRetry={() => pvp.reload()} />}

      {r && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px]">
            <span className={r.coverage.complete ? 'text-fog-400' : 'text-ember-300'}>
              {r.coverage.complete ? '✓ Historial completo analizado' : '◆ Resultados parciales'} · {fmt(r.coverage.scanned)} partidas tuyas escaneadas
              {r.coverage.oldest && ` (desde ${date(r.coverage.oldest)})`}
              {r.timeline.length > 0 && ` · estadísticas detalladas en ${r.statsLoaded}/${r.timeline.length}`}
            </span>
            <div className="flex gap-2">
              {!r.coverage.complete && (
                <button className="st-btn-ghost !py-1" disabled={pvp.loading} onClick={() => pvp.reload({ scanOlder: true })}>
                  Escanear más antiguo
                </button>
              )}
              {r.statsLoaded < r.timeline.length && (
                <button className="st-btn-ghost !py-1" disabled={pvp.loading} onClick={() => pvp.reload({ loadStats: true })}>
                  Cargar más estadísticas
                </button>
              )}
            </div>
          </div>

          {r.shared.count === 0 ? (
            <Empty
              title="Sin partidas en común"
              body={
                r.coverage.complete
                  ? 'No habéis coincidido en ninguna partida CS2 de FACEIT en este período.'
                  : 'No hay coincidencias en el historial escaneado hasta ahora. Escanea partidas más antiguas para buscar más atrás.'
              }
            />
          ) : (
            <>
              <div className={cx('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4')}>
                <StatTile label="Partidas compartidas" value={fmt(r.shared.count)} sub="Mismo match, cualquier equipo" hint="Partida compartida = ambos jugadores estuvieron en el mismo match, en cualquier equipo." />
                <StatTile label="Como compañeros" value={fmt(r.asTeammates.count)} sub={`${r.asTeammates.wins} V · ${r.asTeammates.losses} D · ${pct(r.asTeammates.winRate)}`} />
                <StatTile label="Como rivales" value={fmt(r.asEnemies.count)} tone="ember" sub={`${r.asEnemies.wins} V · ${r.asEnemies.losses} D`} hint="Enfrentamiento directo = estuvisteis en equipos contrarios." />
                <StatTile
                  label="Win rate H2H"
                  value={pct(r.asEnemies.winRate)}
                  tone={r.asEnemies.winRate === null ? undefined : r.asEnemies.winRate >= 50 ? 'up' : 'down'}
                  sub="Tu win rate cuando fuisteis rivales"
                />
              </div>

              {r.asEnemies.count > 0 && (
                <Card title="Rendimiento en enfrentamientos directos">
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
                  <Source>
                    /matches/&#123;id&#125;/stats · {r.meVsAvg.sample} de {r.asEnemies.count} enfrentamientos con estadísticas cargadas · último: {relative(r.lastFaced)}
                  </Source>
                </Card>
              )}

              <div className={cx('grid gap-3', !compact && 'lg:grid-cols-[1fr_1.6fr]')}>
                <Card title="Mapas">
                  {r.maps.length ? (
                    <ul className="space-y-2">
                      {r.maps.map((m) => (
                        <li key={m.map} className="flex items-center gap-3">
                          <MapBadge map={m.map} size="sm" />
                          <span className="flex-1">{mapLabel(m.map)}</span>
                          <span className="text-[12px] text-fog-400">
                            {m.enemy} rival · {m.teammate} compañero
                          </span>
                          {m.enemy > 0 && (
                            <span className="st-num text-[12px]">
                              <span className="text-win">{m.enemyWins}</span>-<span className="text-loss">{m.enemyLosses}</span>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-fog-500">El mapa se obtiene de las estadísticas por partida; carga más estadísticas para verlo.</p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-fog-400">
                    <div>
                      Última vez juntos: <span className="text-fog-100">{date(r.lastTogether)}</span>
                    </div>
                    <div>
                      Último enfrentamiento: <span className="text-fog-100">{date(r.lastFaced)}</span>
                    </div>
                  </div>
                </Card>

                <Card
                  title="Historial cronológico"
                  pad={false}
                  right={
                    <Segmented
                      value={relFilter}
                      onChange={setRelFilter}
                      options={[
                        { key: 'all', label: 'Todas' },
                        { key: 'enemy', label: 'Rivales' },
                        { key: 'teammate', label: 'Compañeros' },
                      ]}
                    />
                  }
                >
                  <div className="st-scroll max-h-[360px] overflow-auto">
                    <table className="st-table w-full text-[12px]">
                      <thead className="sticky top-0 bg-ink-900">
                        <tr>
                          <th>Fecha</th>
                          <th>Rol</th>
                          <th>Mapa</th>
                          <th>Res.</th>
                          <th className="!text-right">Tú K/D</th>
                          <th className="!text-right">Él K/D</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {timeline.map((t) => (
                          <tr key={t.matchId} className="hover:bg-white/[0.02]">
                            <td>{date(t.startedAt)}</td>
                            <td>
                              <span className={cx('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', t.relation === 'enemy' ? 'bg-ember-500/15 text-ember-300' : 'bg-white/5 text-fog-300')}>
                                {t.relation === 'enemy' ? 'Rival' : 'Compañero'}
                              </span>
                            </td>
                            <td>{t.map ? mapLabel(t.map) : '—'}</td>
                            <td>
                              <span className="flex items-center gap-1.5">
                                <ResultChip win={t.myWin} />
                                <span className="text-fog-500">{t.score ?? ''}</span>
                              </span>
                            </td>
                            <td className="text-right">{ratio(t.me?.kd)}</td>
                            <td className="text-right">{ratio(t.other?.kd)}</td>
                            <td className="text-right">
                              <a className="st-btn-ghost !px-2 !py-0.5 text-[11px]" href={t.faceitUrl} target="_blank" rel="noreferrer">
                                VER PARTIDA
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
          <Source>FACEIT Data API · /players/&#123;id&#125;/history (rosters de ambos equipos) · período: {RESULT_FILTERS.find((f) => f.key === period)!.label.toLowerCase()}</Source>
        </>
      )}
      {!r && !pvp.error && <SkeletonGrid n={4} />}

      {me.data && other.data && meL.data && otherL.data && (
        <Card title={`${me.data.nickname} vs ${other.data.nickname} · perfil general`} pad={false}>
          <CompareTable
            me={me.data}
            other={other.data}
            meL={meL.data}
            otherL={otherL.data}
            meRecentKd={meR.data ? formSummary(meR.data).kd : null}
            otherRecentKd={otherR.data ? formSummary(otherR.data).kd : null}
          />
          <div className="px-4 pb-3">
            <Source>FACEIT Data API · lifetime CS2 (K/D últ. 20 desde /games/cs2/stats)</Source>
          </div>
        </Card>
      )}
    </div>
  );
}
