import { Fragment, useMemo, useState } from 'react';
import type { Faction, HistoryMatch, MatchStatLine } from '@shared/types/faceit';
import { factionOf } from '@shared/utils/analytics';
import { date, duration, fmt, pct, ratio } from '@shared/utils/format';
import { mapLabel } from '@shared/utils/maps';
import { useRpc } from '../hooks/useRpc';
import { Card, Empty, ErrorBox, MapBadge, ResultChip, Segmented, Skeleton, Source, Spinner, cx } from './ui';

const PAGE = 20;

/** Scoreboard of one match: both teams, every player's line. */
export function MatchDetail({ matchId, onOpenPlayer, highlight }: { matchId: string; onOpenPlayer?: (id: string) => void; highlight?: string }) {
  const details = useRpc('match.details', { id: matchId });
  const stats = useRpc('match.stats', { id: matchId });
  if (details.error) return <ErrorBox error={details.error} onRetry={() => details.reload()} />;
  if (!details.data || stats.loading) return <Skeleton className="h-40" />;
  const m = details.data;
  const s = stats.data;
  const factions: Faction[] = ['faction1', 'faction2'];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fog-400">
        <span className="font-mono text-fog-500">{m.matchId}</span>
        <span>{date(m.startedAt ?? m.configuredAt, true)}</span>
        <span>Duración: {duration(m.startedAt, m.finishedAt)}</span>
        <span>Mapa: {mapLabel(s?.map ?? m.map)}</span>
        <span>Score: {s?.score ?? '—'}</span>
        <span title="FACEIT Data API no expone el ELO ganado/perdido por partida">ELO ±: no disponible</span>
        <a className="st-btn-primary !py-0.5 text-[11px]" href={m.faceitUrl} target="_blank" rel="noreferrer">
          VER PARTIDA
        </a>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {factions.map((f) => {
          const roster = m.teams[f];
          const ids = new Set(roster.players.map((p) => p.id));
          const team = s?.teams.find((t) => t.players.some((p) => ids.has(p.playerId)));
          const won = m.winner ? m.winner === f : team?.win ?? null;
          return (
            <div key={f} className="rounded-lg border border-white/[0.06]">
              <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-1.5">
                <span className="font-semibold">{roster.name}</span>
                <span className="flex items-center gap-2">
                  <span className="st-num">{team?.finalScore ?? ''}</span>
                  <ResultChip win={won} />
                </span>
              </div>
              <table className="st-table w-full text-[12px]">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th className="!text-right">K</th>
                    <th className="!text-right">D</th>
                    <th className="!text-right">A</th>
                    <th className="!text-right">K/D</th>
                    <th className="!text-right">ADR</th>
                    <th className="!text-right">HS%</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {roster.players.map((p) => {
                    const ps = team?.players.find((x) => x.playerId === p.id);
                    return (
                      <tr key={p.id} className={cx(p.id === highlight && 'bg-ember-500/[0.07]')}>
                        <td className="max-w-[120px] truncate">{p.nickname}</td>
                        <td className="text-right">{fmt(ps?.kills)}</td>
                        <td className="text-right">{fmt(ps?.deaths)}</td>
                        <td className="text-right">{fmt(ps?.assists)}</td>
                        <td className="text-right">{ratio(ps?.kd)}</td>
                        <td className="text-right">{fmt(ps?.adr, 1)}</td>
                        <td className="text-right">{pct(ps?.hsPercent)}</td>
                        <td className="text-right">
                          {onOpenPlayer && (
                            <button className="text-[11px] text-ember-400 hover:underline" onClick={() => onOpenPlayer(p.id)}>
                              Stats
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      {!s && <p className="text-[11px] text-fog-500">FACEIT no tiene estadísticas para esta partida (cancelada o aún en curso).</p>}
    </div>
  );
}

type Sort = 'new' | 'old' | 'kd' | 'adr';

export function MatchHistory({ playerId, onOpenPlayer }: { playerId: string; onOpenPlayer?: (id: string) => void }) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('new');
  const [result, setResult] = useState<'all' | 'win' | 'loss'>('all');
  const [map, setMap] = useState<string>('all');
  const history = useRpc('player.history', { id: playerId, offset, limit: PAGE });
  const stats = useRpc('player.recent', { id: playerId, limit: 100 });

  const byId = useMemo(() => new Map<string, MatchStatLine>((stats.data ?? []).map((l) => [l.matchId, l])), [stats.data]);

  const rows = useMemo(() => {
    const list = (history.data ?? []).map((m: HistoryMatch) => {
      const fac = factionOf(m, playerId);
      const line = byId.get(m.matchId);
      return { m, line, win: m.winner && fac ? m.winner === fac : line?.win ?? null };
    });
    const filtered = list.filter((r) => (result === 'all' || (result === 'win' ? r.win === true : r.win === false)) && (map === 'all' || r.line?.map === map));
    const val = (r: (typeof list)[number]) => (sort === 'kd' ? r.line?.kd : sort === 'adr' ? r.line?.adr : r.m.startedAt) ?? -1;
    return filtered.sort((a, b) => (sort === 'old' ? val(a) - val(b) : val(b) - val(a)));
  }, [history.data, byId, playerId, sort, result, map]);

  const maps = useMemo(() => [...new Set((stats.data ?? []).map((l) => l.map).filter(Boolean) as string[])], [stats.data]);

  return (
    <Card
      title="Historial de partidas"
      pad={false}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={result}
            onChange={setResult}
            options={[
              { key: 'all', label: 'Todas' },
              { key: 'win', label: 'Victorias' },
              { key: 'loss', label: 'Derrotas' },
            ]}
          />
          <select className="st-input !w-auto !py-1" value={map} onChange={(e) => setMap(e.target.value)} aria-label="Filtrar por mapa">
            <option value="all">Todos los mapas</option>
            {maps.map((m) => (
              <option key={m} value={m}>
                {mapLabel(m)}
              </option>
            ))}
          </select>
          <select className="st-input !w-auto !py-1" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
            <option value="new">Más recientes</option>
            <option value="old">Más antiguas</option>
            <option value="kd">Mejor K/D</option>
            <option value="adr">Mejor ADR</option>
          </select>
        </div>
      }
    >
      {history.error ? (
        <div className="p-4">
          <ErrorBox error={history.error} onRetry={() => history.reload()} />
        </div>
      ) : history.loading && !history.data ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : !rows.length ? (
        <div className="p-4">
          <Empty title="Sin partidas" body={offset > 0 ? 'No hay más partidas.' : 'No hay partidas que coincidan con los filtros en esta página.'} />
        </div>
      ) : (
        <div className="st-scroll overflow-x-auto">
          <table className="st-table w-full text-[12px]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Mapa</th>
                <th>Res.</th>
                <th>Score</th>
                <th>Equipos</th>
                <th className="!text-right">K-D-A</th>
                <th className="!text-right">K/D</th>
                <th className="!text-right">ADR</th>
                <th className="!text-right">HS%</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, line, win }) => (
                <Fragment key={m.matchId}>
                  <tr className="cursor-pointer hover:bg-white/[0.02]" onClick={() => setOpen(open === m.matchId ? null : m.matchId)}>
                    <td>{date(m.startedAt, true)}</td>
                    <td>
                      <span className="flex items-center gap-2">
                        <MapBadge map={line?.map ?? null} size="sm" />
                        {line?.map ? mapLabel(line.map) : <span className="text-fog-500">—</span>}
                      </span>
                    </td>
                    <td>
                      <ResultChip win={win} />
                    </td>
                    <td className="st-num">{line?.score ?? '—'}</td>
                    <td className="max-w-[220px] truncate text-fog-400">
                      {m.teams.faction1.name} vs {m.teams.faction2.name}
                    </td>
                    <td className="text-right">{line ? `${fmt(line.kills)}-${fmt(line.deaths)}-${fmt(line.assists)}` : '—'}</td>
                    <td className={cx('text-right', line?.kd != null && (line.kd >= 1 ? 'text-win' : 'text-loss'))}>{ratio(line?.kd)}</td>
                    <td className="text-right">{fmt(line?.adr, 1)}</td>
                    <td className="text-right">{pct(line?.hsPercent)}</td>
                    <td className="text-right">
                      <a className="st-btn-ghost !px-2 !py-0.5 text-[11px]" href={m.faceitUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        VER PARTIDA
                      </a>
                    </td>
                  </tr>
                  {open === m.matchId && (
                    <tr>
                      <td colSpan={10} className="!whitespace-normal bg-ink-950/50 !p-3">
                        <MatchDetail matchId={m.matchId} onOpenPlayer={onOpenPlayer} highlight={playerId} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3">
        <Source>
          /players/&#123;id&#125;/history + /games/cs2/stats (stats unidas para las últimas 100 partidas; abre una partida para ver su scoreboard). Filtros y orden aplican a esta página.
        </Source>
        <div className="flex items-center gap-2">
          {history.loading && <Spinner />}
          <button className="st-btn-ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            ← Anterior
          </button>
          <span className="st-num text-[12px] text-fog-400">Pág. {offset / PAGE + 1}</span>
          <button className="st-btn-ghost" disabled={(history.data?.length ?? 0) < PAGE} onClick={() => setOffset(offset + PAGE)}>
            Siguiente →
          </button>
        </div>
      </div>
    </Card>
  );
}
