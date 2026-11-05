/**
 * Pure analytics over normalised FACEIT data. No I/O — fully unit-tested.
 *
 * Conventions
 *  - Lists of matches are ordered most-recent-first.
 *  - Aggregated K/D is Σkills / Σdeaths (not the mean of per-match ratios).
 *  - ADR / HS% are simple means over matches that report them.
 *  - Any metric with no contributing data is `null`.
 */
import type {
  Averages,
  FormSummary,
  HistoryCoverage,
  MapWindowStats,
  PvpMatch,
  PvpResult,
  Record3,
  StreakInfo,
} from '../types/analytics';
import type { Faction, HistoryMatch, MatchStatLine, MatchStats } from '../types/faceit';
import { round2 } from './parse';
import { isCompetitiveMap } from './maps';

const mean = (xs: (number | null | undefined)[]): number | null => {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const sum = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};
const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export function record(results: (boolean | null)[]): Record3 {
  const decided = results.filter((r): r is boolean => r !== null);
  const wins = decided.filter(Boolean).length;
  return {
    count: results.length,
    wins,
    losses: decided.length - wins,
    winRate: decided.length ? r1((wins / decided.length) * 100) : null,
  };
}

/** Current streak from a most-recent-first list of results. */
export function currentStreak(results: (boolean | null)[]): StreakInfo {
  const decided = results.filter((r): r is boolean => r !== null);
  if (!decided.length) return { type: null, length: 0 };
  const first = decided[0];
  let n = 0;
  for (const r of decided) {
    if (r !== first) break;
    n++;
  }
  return { type: first ? 'win' : 'loss', length: n };
}

export function longestStreak(results: (boolean | null)[], want: boolean): number {
  let best = 0;
  let run = 0;
  for (const r of results) {
    if (r === null) continue;
    run = r === want ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function aggregateKd(lines: { kills: number | null; deaths: number | null; kd?: number | null }[]): number | null {
  const withKD = lines.filter((l) => l.kills !== null && l.deaths !== null);
  if (withKD.length) {
    const k = sum(withKD.map((l) => l.kills))!;
    const d = sum(withKD.map((l) => l.deaths))!;
    return d === 0 ? round2(k) : round2(k / d);
  }
  const m = mean(lines.map((l) => l.kd ?? null));
  return m === null ? null : round2(m);
}

export function formSummary(lines: MatchStatLine[]): FormSummary {
  const rec = record(lines.map((l) => l.win));
  const kills = sum(lines.map((l) => l.kills));
  const rounds = sum(lines.map((l) => (l.kills !== null ? l.rounds : null)));
  const kr = mean(lines.map((l) => l.kr));
  return {
    matches: lines.length,
    wins: rec.wins,
    losses: rec.losses,
    winRate: rec.winRate,
    kd: aggregateKd(lines),
    kr: kr !== null ? round2(kr) : kills !== null && rounds ? round2(kills / rounds) : null,
    adr: r1(mean(lines.map((l) => l.adr))),
    hsPercent: r1(mean(lines.map((l) => l.hsPercent))),
    avgKills: r1(mean(lines.map((l) => l.kills))),
  };
}

/** Per-map stats over the given window of recent matches (most recent first). */
export function mapWindowStats(lines: MatchStatLine[]): MapWindowStats[] {
  const byMap = new Map<string, MatchStatLine[]>();
  for (const l of lines) {
    if (!l.map || !isCompetitiveMap(l.map)) continue;
    const arr = byMap.get(l.map) ?? [];
    arr.push(l);
    byMap.set(l.map, arr);
  }
  return [...byMap.entries()]
    .map(([map, ls]) => {
      const res = ls.map((l) => l.win);
      const rec = record(res);
      return {
        map,
        matches: ls.length,
        wins: rec.wins,
        losses: rec.losses,
        winRate: rec.winRate,
        kd: aggregateKd(ls),
        adr: r1(mean(ls.map((l) => l.adr))),
        hsPercent: r1(mean(ls.map((l) => l.hsPercent))),
        currentStreak: currentStreak(res),
        longestWinStreak: longestStreak(res, true),
        longestLossStreak: longestStreak(res, false),
      };
    })
    .sort((a, b) => b.matches - a.matches || (b.winRate ?? 0) - (a.winRate ?? 0));
}

// ───────────────────────────── Player vs Player ─────────────────────────────

export function factionOf(match: HistoryMatch, playerId: string): Faction | null {
  if (match.teams.faction1.players.some((p) => p.id === playerId)) return 'faction1';
  if (match.teams.faction2.players.some((p) => p.id === playerId)) return 'faction2';
  return null;
}

/**
 * Finds the matches in `meHistory` that `otherId` also played.
 * A *shared* match = same match; *enemy* = opposite factions; *teammate* = same faction.
 */
export function findSharedMatches(meHistory: HistoryMatch[], meId: string, otherId: string) {
  const out: { match: HistoryMatch; myFaction: Faction; relation: 'teammate' | 'enemy' }[] = [];
  for (const m of meHistory) {
    const mine = factionOf(m, meId);
    if (!mine) continue;
    const theirs = factionOf(m, otherId);
    if (!theirs) continue;
    out.push({ match: m, myFaction: mine, relation: mine === theirs ? 'teammate' : 'enemy' });
  }
  return out;
}

function lineFromStats(stats: MatchStats | undefined, playerId: string) {
  if (!stats) return null;
  for (const t of stats.teams) {
    const p = t.players.find((x) => x.playerId === playerId);
    if (p) return { kills: p.kills, deaths: p.deaths, kd: p.kd, adr: p.adr, hsPercent: p.hsPercent };
  }
  return null;
}

function averages(lines: (ReturnType<typeof lineFromStats>)[]): Averages {
  const ls = lines.filter((l): l is NonNullable<typeof l> => !!l);
  const kd = aggregateKd(ls);
  return { kd, adr: r1(mean(ls.map((l) => l.adr))), hsPercent: r1(mean(ls.map((l) => l.hsPercent))), sample: ls.length };
}

export function computePvp(args: {
  meId: string;
  otherId: string;
  history: HistoryMatch[];
  coverage: HistoryCoverage;
  statsById: Record<string, MatchStats | undefined>;
  /** inclusive lower bound, epoch ms. Use 0 / -Infinity for all. */
  since?: number;
}): PvpResult {
  const { meId, otherId, history, coverage, statsById } = args;
  const since = args.since ?? -Infinity;
  const shared = findSharedMatches(
    history.filter((m) => m.startedAt >= since),
    meId,
    otherId,
  ).sort((a, b) => b.match.startedAt - a.match.startedAt);

  const timeline: PvpMatch[] = shared.map(({ match, myFaction, relation }) => {
    const stats = statsById[match.matchId];
    return {
      matchId: match.matchId,
      startedAt: match.startedAt,
      faceitUrl: match.faceitUrl,
      relation,
      myFaction,
      myWin: match.winner ? match.winner === myFaction : null,
      map: stats?.map ?? null,
      score: stats?.score ?? null,
      me: lineFromStats(stats, meId),
      other: lineFromStats(stats, otherId),
    };
  });

  const enemies = timeline.filter((t) => t.relation === 'enemy');
  const mates = timeline.filter((t) => t.relation === 'teammate');

  const mapAgg = new Map<string, { map: string; enemy: number; teammate: number; enemyWins: number; enemyLosses: number }>();
  for (const t of timeline) {
    if (!t.map) continue;
    const a = mapAgg.get(t.map) ?? { map: t.map, enemy: 0, teammate: 0, enemyWins: 0, enemyLosses: 0 };
    if (t.relation === 'enemy') {
      a.enemy++;
      if (t.myWin === true) a.enemyWins++;
      if (t.myWin === false) a.enemyLosses++;
    } else a.teammate++;
    mapAgg.set(t.map, a);
  }

  return {
    meId,
    otherId,
    shared: record(timeline.map((t) => t.myWin)),
    asTeammates: record(mates.map((t) => t.myWin)),
    asEnemies: record(enemies.map((t) => t.myWin)),
    meVsAvg: averages(enemies.map((t) => t.me)),
    otherVsAvg: averages(enemies.map((t) => t.other)),
    maps: [...mapAgg.values()].sort((a, b) => b.enemy + b.teammate - (a.enemy + a.teammate)),
    lastTogether: mates[0]?.startedAt ?? null,
    lastFaced: enemies[0]?.startedAt ?? null,
    timeline,
    coverage,
    statsLoaded: timeline.filter((t) => statsById[t.matchId]).length,
  };
}

/** Merges newly fetched history pages into a deduplicated, newest-first list. */
export function mergeHistory(existing: HistoryMatch[], incoming: HistoryMatch[]): HistoryMatch[] {
  const map = new Map(existing.map((m) => [m.matchId, m]));
  for (const m of incoming) map.set(m.matchId, m);
  return [...map.values()].sort((a, b) => b.startedAt - a.startedAt);
}
