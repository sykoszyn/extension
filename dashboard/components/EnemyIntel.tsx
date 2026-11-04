import type { PlayerIntel } from '@shared/types/analytics';
import { date, fmt, pct, ratio } from '@shared/utils/format';
import { mapLabel } from '@shared/utils/maps';
import { MIN_MAP_SAMPLE, PREMADE_MIN_SHARED } from '@shared/utils/intel';
import { SERIES } from '../charts';
import { useRpc } from '../hooks/useRpc';
import { Card, Empty, ErrorBox, MapBadge, Notice, Skeleton, Source, Spinner, cx } from './ui';

function IntelCard({ p, hot }: { p: PlayerIntel; hot: boolean }) {
  const met = p.shared.count > 0;
  return (
    <div className={cx('st-card p-3', hot && 'border-ember-500/40')}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-display text-[16px] font-bold uppercase tracking-wide">{p.nickname}</div>
          <div className="text-[11px] text-fog-500">
            Últ. {p.recentMatches}: K/D {ratio(p.recentKd)} · ADR {fmt(p.recentAdr, 1)} · WR {pct(p.recentWinRate)}
          </div>
        </div>
        {hot && <span className="shrink-0 rounded bg-ember-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ember-300">Más en forma</span>}
      </div>

      <div className="mt-2 rounded-lg bg-white/[0.02] px-2.5 py-2 text-[12px]">
        {met ? (
          <>
            <div>
              Contra ti: <b className="text-fog-100">{p.asEnemies.count}</b>
              {p.asEnemies.count > 0 && (
                <>
                  {' '}
                  · tu récord <span className="text-win">{p.asEnemies.wins}</span>-<span className="text-loss">{p.asEnemies.losses}</span> ({pct(p.asEnemies.winRate)})
                </>
              )}
            </div>
            <div className="text-fog-400">
              Contigo: {p.asTeammates.count}
              {p.asTeammates.count > 0 && ` · ${p.asTeammates.wins}-${p.asTeammates.losses}`} · última vez {date(p.lastMet)}
            </div>
          </>
        ) : (
          <span className="text-fog-500">No aparece en tu historial analizado.</span>
        )}
      </div>

      <div className="mt-2">
        <div className="st-label">Mejores mapas (lifetime, ≥{MIN_MAP_SAMPLE} partidas)</div>
        {p.bestMaps.length ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {p.bestMaps.map((m) => (
              <span key={m.map} className="flex items-center gap-1 rounded-md bg-white/[0.03] py-0.5 pl-0.5 pr-2 text-[11px]" title={`${m.matches} partidas`}>
                <MapBadge map={m.map} size="sm" /> {pct(m.winRate)}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-[11px] text-fog-500">Sin muestra suficiente.</div>
        )}
        {p.worstMap && (
          <div className="mt-1.5 text-[11px] text-fog-400">
            Peor mapa: <b className="text-loss">{mapLabel(p.worstMap.map)}</b> {pct(p.worstMap.winRate)} ({p.worstMap.matches} partidas)
          </div>
        )}
      </div>
    </div>
  );
}

/** Enemy Intelligence tab of the Lobby Analyzer. */
export function EnemyIntel({ matchId, myPlayerId, labels }: { matchId: string; myPlayerId: string; labels: [string, string] }) {
  const intel = useRpc('lobby.intel', { matchId });
  if (intel.error) return <ErrorBox error={intel.error} onRetry={() => intel.reload()} />;
  if (!intel.data)
    return (
      <div className="space-y-3">
        <Skeleton className="h-10" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    );

  const d = intel.data;
  const enemies = d.players.filter((p) => p.side === 'enemy' || (d.myFaction === null && p.faction === 'faction2'));
  const mates = d.players.filter((p) => !enemies.includes(p));
  const hot = [...enemies].filter((p) => p.recentKd !== null).sort((a, b) => b.recentKd! - a.recentKd! || (b.recentAdr ?? 0) - (a.recentAdr ?? 0))[0]?.playerId;
  const c = d.coverage;

  return (
    <div className="space-y-3">
      {!myPlayerId && <Notice>Vincula tu cuenta en Ajustes para ver tus enfrentamientos previos con cada jugador.</Notice>}
      {myPlayerId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px]">
          <span className={c.complete ? 'text-fog-400' : 'text-ember-300'}>
            {c.complete ? '✓ Historial completo' : '◆ Historial parcial'} · {fmt(c.scanned)} partidas tuyas guardadas en este navegador{c.oldest ? ` (desde ${date(c.oldest)})` : ''}
          </span>
          {!c.complete && (
            <button className="st-btn-ghost !py-1" disabled={intel.loading} onClick={() => intel.reload({ scanOlder: true })}>
              {intel.loading ? <Spinner /> : 'Buscar más atrás'}
            </button>
          )}
        </div>
      )}

      <Card title={<span style={{ color: SERIES.them }}>{labels[1]} · Enemy Intelligence</span>}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {enemies.map((p) => (
            <IntelCard key={p.playerId} p={p} hot={p.playerId === hot} />
          ))}
        </div>
        <Source>Encuentros: tu historial local (/players/&#123;id&#125;/history). Mapas: lifetime de FACEIT. Forma: últimas 20 partidas. «Más en forma» = mayor K/D en las últimas 20.</Source>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Veto · win rate lifetime por mapa">
          {d.veto.some((v) => v.diff !== null) ? (
            <table className="st-table w-full text-[12px]">
              <thead>
                <tr>
                  <th>Mapa</th>
                  <th className="!text-right" style={{ color: SERIES.you }}>
                    {labels[0]}
                  </th>
                  <th className="!text-right" style={{ color: SERIES.them }}>
                    {labels[1]}
                  </th>
                  <th className="!text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {d.veto.map((v) => (
                  <tr key={v.map}>
                    <td>
                      <span className="flex items-center gap-2">
                        <MapBadge map={v.map} size="sm" />
                        {mapLabel(v.map)}
                      </span>
                    </td>
                    <td className="text-right">
                      {pct(v.ourWr, 1)} <span className="text-fog-500">({v.ourSample})</span>
                    </td>
                    <td className="text-right">
                      {pct(v.theirWr, 1)} <span className="text-fog-500">({v.theirSample})</span>
                    </td>
                    <td className={cx('st-num text-right', v.diff !== null && v.diff !== 0 && (v.diff > 0 ? 'text-win' : 'text-loss'))}>{v.diff === null ? '—' : `${v.diff > 0 ? '+' : ''}${fmt(v.diff, 1)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="Sin muestra suficiente" />
          )}
          <Source>Media del win rate lifetime de los jugadores con ≥{MIN_MAP_SAMPLE} partidas en el mapa (entre paréntesis, cuántos). No predice el resultado.</Source>
        </Card>

        <Card title="Posibles premades">
          {d.premades.length ? (
            <ul className="space-y-2 text-[13px]">
              {d.premades.map((g, i) => (
                <li key={i} className="rounded-lg bg-white/[0.02] px-3 py-2">
                  <span className="st-label mr-2" style={{ color: g.faction === (d.myFaction ?? 'faction1') ? SERIES.you : SERIES.them }}>
                    {g.faction === (d.myFaction ?? 'faction1') ? labels[0] : labels[1]}
                  </span>
                  <b>{g.players.map((p) => p.nickname).join(' + ')}</b>
                  <div className="text-[11px] text-fog-500">Juntos en hasta {g.sharedRecent} de sus últimas 20 partidas</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-fog-500">No se detectan grupos: ningún par comparte {PREMADE_MIN_SHARED} o más de sus últimas 20 partidas.</p>
          )}
          <Source>Inferencia a partir de los IDs de las últimas 20 partidas de cada jugador. FACEIT no publica si un grupo es premade.</Source>
        </Card>
      </div>

      {mates.length > 0 && (
        <Card title={<span style={{ color: SERIES.you }}>{labels[0]} · tus compañeros</span>}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {mates.map((p) => (
              <IntelCard key={p.playerId} p={p} hot={false} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
