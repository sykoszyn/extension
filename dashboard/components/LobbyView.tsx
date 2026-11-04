import { Fragment, useEffect, useMemo, useState } from 'react';
import type { LobbyPlayer, LobbyTeam, TeamStrength } from '@shared/types/analytics';
import type { MatchDetails } from '@shared/types/faceit';
import { currentStreak, formSummary, mapWindowStats } from '@shared/utils/analytics';
import { fmt, pct, ratio } from '@shared/utils/format';
import { mapLabel } from '@shared/utils/maps';
import { compareTeams, NORMALISERS, SPI_WEIGHTS, teamStrength } from '@shared/utils/strength';
import { SERIES, StrengthChart } from '../charts';
import { useRpc } from '../hooks/useRpc';
import { MapCard, MapPerformance } from './MapPerformance';
import { Avatar, Card, Empty, ErrorBox, Flag, FormStrip, LevelBadge, MapBadge, Notice, Segmented, Skeleton, Source, Spinner, cx } from './ui';

const LIVE = new Set(['VOTING', 'CONFIGURING', 'READY', 'CHECK_IN', 'SUBSTITUTION', 'ONGOING', 'CAPTAIN_PICK']);

function PlayerRow({ p, me, expanded, onToggle, onOpen, accent }: { p: LobbyPlayer; me: boolean; expanded: boolean; onToggle: () => void; onOpen?: (id: string) => void; accent: string }) {
  const f = formSummary(p.recent.slice(0, 20));
  const streak = currentStreak(p.recent.map((r) => r.win));
  const lastMaps = p.recent.slice(0, 3).map((r) => r.map);
  const name = p.profile?.nickname ?? p.rosterNickname;
  return (
    <>
      <tr className={cx('cursor-pointer hover:bg-white/[0.03]', expanded && 'bg-white/[0.03]')} onClick={onToggle}>
        <td className="!pl-0">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-[3px] rounded-r" style={{ background: accent }} />
            <Avatar src={p.profile?.avatar ?? p.rosterAvatar} name={name} size={30} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-semibold">
                <span className="max-w-[130px] truncate">{name}</span>
                {me && <span className="rounded bg-ember-500/20 px-1 text-[9px] font-bold uppercase text-ember-300">Tú</span>}
                <Flag country={p.profile?.country} />
              </div>
              {p.error && <div className="max-w-[160px] truncate text-[10px] text-blood-400" title={p.error}>Datos incompletos</div>}
            </div>
          </div>
        </td>
        <td>
          <LevelBadge level={p.profile?.level ?? p.rosterLevel} size={22} />
        </td>
        <td className="st-num text-right text-[14px]">{fmt(p.profile?.elo)}</td>
        <td className="text-right">{pct(p.lifetime?.winRate)}</td>
        <td className={cx('text-right', f.kd !== null && (f.kd >= 1 ? 'text-win' : 'text-loss'))}>{ratio(f.kd)}</td>
        <td className="text-right">{fmt(f.adr, 1)}</td>
        <td className="text-right">{pct(f.hsPercent)}</td>
        <td className="text-right">{fmt(p.lifetime?.matches)}</td>
        <td>
          <FormStrip results={p.recent.map((r) => r.win)} max={5} nowrap />
        </td>
        <td className={cx('st-num', streak.type === 'win' ? 'text-win' : streak.type === 'loss' ? 'text-loss' : 'text-fog-500')}>
          {streak.type ? `${streak.length}${streak.type === 'win' ? 'V' : 'D'}` : '—'}
        </td>
        <td>
          <div className="flex gap-1">
            {lastMaps.map((m, i) => (
              <MapBadge key={i} map={m} size="sm" />
            ))}
          </div>
        </td>
        <td className="text-right">
          {onOpen && (
            <button
              className="st-btn-ghost !px-2 !py-0.5 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(p.rosterId);
              }}
            >
              Stats
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={12} className="!whitespace-normal bg-ink-950/50 !p-3">
            {p.recent.length ? <MapPerformance lines={p.recent} lifetime={p.lifetime} /> : <Empty title="Sin partidas recientes" />}
          </td>
        </tr>
      )}
    </>
  );
}

function TeamTable({ team, label, accent, myId, onOpen }: { team: LobbyTeam; label: string; accent: string; myId: string; onOpen?: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card
      pad={false}
      title={
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          <span className="text-fog-100">{label}</span>
          <span className="font-normal normal-case tracking-normal text-fog-500">· {team.name}</span>
        </span>
      }
    >
      <div className="st-scroll overflow-x-auto">
        <table className="st-table w-full text-[12px]">
          <thead>
            <tr>
              <th className="!pl-3">Jugador</th>
              <th>Lvl</th>
              <th className="!text-right">ELO</th>
              <th className="!text-right">WR</th>
              <th className="!text-right">K/D·20</th>
              <th className="!text-right">ADR·20</th>
              <th className="!text-right">HS%·20</th>
              <th className="!text-right">Partidas</th>
              <th>Forma</th>
              <th>Racha</th>
              <th>Últimos mapas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {team.players.map((p) => (
              <PlayerRow key={p.rosterId} p={p} me={p.rosterId === myId} accent={accent} expanded={open === p.rosterId} onToggle={() => setOpen(open === p.rosterId ? null : p.rosterId)} onOpen={onOpen} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-fog-500">Pulsa un jugador para ver su rendimiento por mapa (últ. 5/10/20). WR = lifetime; ·20 = últimas 20 partidas.</p>
    </Card>
  );
}

function SpiFormula() {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-[12px] text-fog-400">
      <button className="text-ember-400 hover:underline" onClick={() => setOpen(!open)}>
        {open ? 'Ocultar fórmula' : '¿Cómo se calcula?'}
      </button>
      {open && (
        <div className="mt-2 space-y-1 rounded-lg border border-white/[0.06] bg-ink-950/60 p-3">
          <p>
            <b>SykosTracker Performance Index (SPI)</b> = Σ peso·puntuación / Σ pesos, sobre los componentes con datos. Cada componente es la media del equipo normalizada a 0–100:
          </p>
          <ul className="list-inside list-disc">
            <li>ELO: (elo − 500) / 2500 · 100 — peso {SPI_WEIGHTS.elo}</li>
            <li>K/D últ. 20: (kd − 0.6) / 1.0 · 100 — peso {SPI_WEIGHTS.kd}</li>
            <li>ADR últ. 20: (adr − 50) / 60 · 100 — peso {SPI_WEIGHTS.adr}</li>
            <li>Win rate últ. 20 — peso {SPI_WEIGHTS.recentWr}</li>
            <li>Win rate lifetime en el mapa elegido — peso {SPI_WEIGHTS.mapWr}</li>
            <li>Experiencia: log10(partidas) / log10(3000) · 100 — peso {SPI_WEIGHTS.experience}</li>
          </ul>
          <p>
            Ejemplo: ELO medio 2000 → {fmt(NORMALISERS.elo(2000), 0)} pts. Todos los valores se limitan a 0–100. <b>No es una probabilidad de victoria.</b>
          </p>
        </div>
      )}
    </div>
  );
}

function StrengthPanel({ you, them, youLabel, themLabel, map }: { you: TeamStrength; them: TeamStrength; youLabel: string; themLabel: string; map: string | null }) {
  const cmp = compareTeams(you, them);
  const rows: [string, string, string][] = [
    ['ELO medio', fmt(you.avgElo), fmt(them.avgElo)],
    ['Win rate medio (lifetime)', pct(you.avgLifetimeWinRate, 1), pct(them.avgLifetimeWinRate, 1)],
    ['K/D medio (últ. 20)', ratio(you.avgRecentKd), ratio(them.avgRecentKd)],
    ['ADR medio (últ. 20)', fmt(you.avgRecentAdr, 1), fmt(them.avgRecentAdr, 1)],
    ['Win rate reciente (últ. 20)', pct(you.avgRecentWinRate, 1), pct(them.avgRecentWinRate, 1)],
    [`Win rate en ${map ? mapLabel(map) : 'el mapa'}`, pct(you.avgMapWinRate, 1), pct(them.avgMapWinRate, 1)],
    ['Experiencia total (partidas)', fmt(you.totalMatches), fmt(them.totalMatches)],
  ];
  const diff = you.avgElo !== null && them.avgElo !== null ? you.avgElo - them.avgElo : null;
  return (
    <Card title="Lobby Strength Analyzer" right={<SpiFormula />}>
      <div className="grid items-center gap-4 lg:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center gap-5">
          {[
            [youLabel, you.index, SERIES.you],
            [themLabel, them.index, SERIES.them],
          ].map(([l, v, c], i) => (
            <Fragment key={String(l)}>
              {i === 1 && <span className="font-display text-[18px] font-black italic text-fog-500">VS</span>}
              <div className="text-center">
                <div className="st-label" style={{ color: String(c) }}>
                  {String(l)}
                </div>
                <div className="st-num text-[44px] leading-none">{v === null ? '—' : fmt(v as number, 1)}</div>
                <div className="text-[10px] uppercase tracking-wider text-fog-500">SPI / 100</div>
              </div>
            </Fragment>
          ))}
        </div>
        <StrengthChart you={you} them={them} youLabel={youLabel} themLabel={themLabel} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <table className="st-table w-full text-[12px]">
          <thead>
            <tr>
              <th />
              <th className="!text-right" style={{ color: SERIES.you }}>
                {youLabel}
              </th>
              <th className="!text-right" style={{ color: SERIES.them }}>
                {themLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, a, b]) => (
              <tr key={k}>
                <td className="text-fog-400">{k}</td>
                <td className="text-right">{a}</td>
                <td className="text-right">{b}</td>
              </tr>
            ))}
            <tr>
              <td className="text-fog-400">Diferencia de ELO</td>
              <td colSpan={2} className={cx('st-num text-right', diff !== null && (diff >= 0 ? 'text-win' : 'text-loss'))}>
                {diff === null ? '—' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="space-y-2 text-[12px]">
          <div className="rounded-lg border border-win/20 bg-win/[0.05] p-3">
            <div className="st-label !text-win">Fortalezas de {youLabel}</div>
            <div className="mt-1 text-fog-300">{cmp.strengths.length ? cmp.strengths.join(' · ') : 'Ninguna ventaja clara (≥5 pts).'}</div>
          </div>
          <div className="rounded-lg border border-loss/20 bg-loss/[0.05] p-3">
            <div className="st-label !text-loss">Debilidades de {youLabel}</div>
            <div className="mt-1 text-fog-300">{cmp.weaknesses.length ? cmp.weaknesses.join(' · ') : 'Ninguna desventaja clara (≥5 pts).'}</div>
          </div>
          <Notice>
            SPI es una métrica propia de SykosTracker con fórmula pública. Resume las estadísticas registradas de cada equipo; <b>no es una probabilidad de victoria</b>. Datos
            disponibles: {you.coverage}/5 vs {them.coverage}/5 jugadores.
          </Notice>
        </div>
      </div>
    </Card>
  );
}

function MapFocus({ teams, match, labels }: { teams: LobbyTeam[]; match: MatchDetails; labels: string[] }) {
  const options = useMemo(() => {
    const set = new Set<string>(match.map ? [match.map] : []);
    match.mapPool.forEach((m) => set.add(m));
    teams.forEach((t) => t.players.forEach((p) => p.recent.forEach((r) => r.map && set.add(r.map))));
    return [...set];
  }, [teams, match]);
  const [map, setMap] = useState<string | null>(match.map ?? options[0] ?? null);
  useEffect(() => {
    if (match.map) setMap(match.map);
  }, [match.map]);
  if (!map) return null;
  return (
    <Card
      title="Map Performance Analyzer"
      right={
        <select className="st-input !w-auto !py-1" value={map} onChange={(e) => setMap(e.target.value)}>
          {options.map((m) => (
            <option key={m} value={m}>
              {mapLabel(m)}
              {m === match.map ? ' (elegido)' : ''}
            </option>
          ))}
        </select>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((t, ti) => (
          <div key={t.faction}>
            <div className="st-label mb-2" style={{ color: ti === 0 ? SERIES.you : SERIES.them }}>
              {labels[ti]}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {t.players.map((p) => {
                const name = p.profile?.nickname ?? p.rosterNickname;
                const stat = mapWindowStats(p.recent.slice(0, 20)).find((m) => m.map === map);
                const lifetime = p.lifetime?.maps.find((m) => m.map === map);
                if (!stat)
                  return (
                    <div key={p.rosterId} className="rounded-xl border border-dashed border-white/10 p-3 text-[12px]">
                      <div className="font-display font-bold uppercase">
                        {name} — {mapLabel(map)}
                      </div>
                      <div className="mt-1 text-fog-500">
                        Sin partidas en {mapLabel(map)} en sus últimas 20.
                        {lifetime && ` Lifetime: ${lifetime.matches} partidas · ${pct(lifetime.winRate)} WR · K/D ${ratio(lifetime.kd)}.`}
                      </div>
                    </div>
                  );
                return <MapCard key={p.rosterId} m={stat} title={`${name} — ${mapLabel(map)}`} lifetimeWr={lifetime?.winRate ?? null} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <Source>FACEIT · últimas 20 partidas de cada jugador (y lifetime por mapa cuando existe). El veto/mapa se actualiza mientras la sala está activa.</Source>
    </Card>
  );
}

/** Lobby Analyzer: the 10 players of a match room, both teams, strength + map analysis. */
export function LobbyView({ matchId, myPlayerId, onOpenPlayer }: { matchId: string; myPlayerId: string; onOpenPlayer?: (id: string) => void }) {
  const lobby = useRpc('lobby.analyze', { matchId });
  const [view, setView] = useState<'teams' | 'strength' | 'maps'>('teams');
  const status = lobby.data?.match.status;

  // While the room is live (veto in progress), refresh the match every 20 s to pick up the map.
  useEffect(() => {
    if (!status || !LIVE.has(status)) return;
    const t = setInterval(() => lobby.reload({ force: true }), 20_000);
    return () => clearInterval(t);
  }, [status, lobby.reload]);

  const ordered = useMemo(() => {
    if (!lobby.data) return null;
    const teams = lobby.data.teams;
    const mineIdx = teams.findIndex((t) => t.players.some((p) => p.rosterId === myPlayerId));
    const inMatch = mineIdx >= 0;
    const sorted = mineIdx === 1 ? [teams[1], teams[0]] : teams;
    return { teams: sorted, labels: inMatch ? ['YOUR TEAM', 'ENEMY TEAM'] : [sorted[0].name, sorted[1].name], inMatch };
  }, [lobby.data, myPlayerId]);

  if (lobby.error) return <ErrorBox error={lobby.error} onRetry={() => lobby.reload()} />;
  if (!lobby.data || !ordered)
    return (
      <div className="space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
        <p className="flex items-center gap-2 text-[12px] text-fog-400">
          <Spinner /> Cargando 10 jugadores (perfil, lifetime y últimas 20 partidas)…
        </p>
      </div>
    );

  const { match } = lobby.data;
  const [a, b] = ordered.teams;
  if (!a?.players.length && !b?.players.length) return <Empty title="Sala sin jugadores todavía" body="FACEIT aún no ha publicado los equipos de esta partida." />;
  const sa = teamStrength(a, match.map);
  const sb = teamStrength(b, match.map);

  return (
    <div className="space-y-3">
      <div className="st-card st-glow flex flex-wrap items-center gap-3 overflow-hidden p-4">
        <MapBadge map={match.map} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[22px] font-bold uppercase leading-none tracking-wide">
            {ordered.labels[0]} <span className="text-ember-500">vs</span> {ordered.labels[1]}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-fog-400">
            <span className={cx('font-semibold', LIVE.has(match.status) ? 'text-ember-300' : '')}>{match.status}</span>
            <span>{match.map ? mapLabel(match.map) : 'Mapa pendiente (veto)'}</span>
            {match.region && <span>{match.region}</span>}
            {match.competition && <span>{match.competition}</span>}
            {lobby.loading && <Spinner />}
          </div>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { key: 'teams', label: 'Equipos' },
            { key: 'strength', label: 'Fuerza' },
            { key: 'maps', label: 'Mapas' },
          ]}
        />
        <a className="st-btn-primary" href={match.faceitUrl} target="_blank" rel="noreferrer">
          VER PARTIDA
        </a>
      </div>

      {!ordered.inMatch && myPlayerId && <Notice>No apareces en esta partida: se muestran los equipos tal como los publica FACEIT.</Notice>}
      {!myPlayerId && <Notice>Configura tu nickname en Ajustes para que SykosTracker separe automáticamente YOUR TEAM y ENEMY TEAM.</Notice>}

      {view === 'teams' && (
        <div className="space-y-3">
          <TeamTable team={a} label={ordered.labels[0]} accent={SERIES.you} myId={myPlayerId} onOpen={onOpenPlayer} />
          <div className="text-center font-display text-[18px] font-black italic tracking-widest text-ember-500">VS</div>
          <TeamTable team={b} label={ordered.labels[1]} accent={SERIES.them} myId={myPlayerId} onOpen={onOpenPlayer} />
        </div>
      )}
      {view === 'strength' && <StrengthPanel you={sa} them={sb} youLabel={ordered.labels[0]} themLabel={ordered.labels[1]} map={match.map} />}
      {view === 'maps' && <MapFocus teams={ordered.teams} match={match} labels={ordered.labels} />}
      <Source>FACEIT Data API · /matches/&#123;id&#125; + perfil, lifetime y últimas 20 partidas de cada jugador (caché 10–30 min).</Source>
    </div>
  );
}
