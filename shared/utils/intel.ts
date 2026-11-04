/**
 * Enemy Intelligence — derived only from data SykosTracker already holds:
 *  - the user's match history discovered locally (IndexedDB) → past encounters
 *    with each of the 10 players, as teammate and as enemy;
 *  - each player's lifetime map segments → best/worst maps and a veto helper;
 *  - each player's last 20 match ids → *possible* premades (two players of the
 *    same team who appear together in several of their recent matches).
 *
 * Nothing is estimated: every figure is a count or a mean of FACEIT data, and
 * "possible premade" is labelled as an inference with its evidence.
 */
import type { LobbyIntel, LobbyTeam, PlayerIntel, PremadeGroup, VetoRow, HistoryCoverage } from '../types/analytics';
import type { Faction, HistoryMatch } from '../types/faceit';
import { factionOf, formSummary, record } from './analytics';

export const MIN_MAP_SAMPLE = 5;
export const PREMADE_MIN_SHARED = 3;

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

function encounters(history: HistoryMatch[], meId: string, otherId: string) {
  const rows: { win: boolean | null; enemy: boolean; at: number }[] = [];
  for (const m of history) {
    const mine = factionOf(m, meId);
    const theirs = mine && factionOf(m, otherId);
    if (!mine || !theirs) continue;
    rows.push({ win: m.winner ? m.winner === mine : null, enemy: mine !== theirs, at: m.startedAt });
  }
  return rows;
}

function mapWr(seg: { matches: number; wins: number; winRate: number | null }) {
  return seg.winRate ?? (seg.matches ? (seg.wins / seg.matches) * 100 : 0);
}

export function playerIntel(team: LobbyTeam, myFaction: Faction | null, meId: string, history: HistoryMatch[]): PlayerIntel[] {
  return team.players
    .filter((p) => p.rosterId !== meId)
    .map((p) => {
      const enc = encounters(history, meId, p.rosterId);
      const maps = (p.lifetime?.maps ?? [])
        .filter((m) => m.matches >= MIN_MAP_SAMPLE)
        .map((m) => ({ map: m.map, matches: m.matches, winRate: Math.round(mapWr(m) * 10) / 10 }))
        .sort((a, b) => b.winRate - a.winRate);
      const form = formSummary(p.recent.slice(0, 20));
      return {
        playerId: p.rosterId,
        nickname: p.profile?.nickname ?? p.rosterNickname,
        faction: team.faction,
        side: myFaction === null ? null : team.faction === myFaction ? 'teammate' : 'enemy',
        shared: record(enc.map((e) => e.win)),
        asEnemies: record(enc.filter((e) => e.enemy).map((e) => e.win)),
        asTeammates: record(enc.filter((e) => !e.enemy).map((e) => e.win)),
        lastMet: enc.length ? Math.max(...enc.map((e) => e.at)) : null,
        bestMaps: maps.slice(0, 3),
        worstMap: maps.length > 1 ? maps[maps.length - 1] : null,
        recentKd: form.kd,
        recentAdr: form.adr,
        recentWinRate: form.winRate,
        recentMatches: form.matches,
      };
    });
}

/** Groups same-team players who share ≥ PREMADE_MIN_SHARED of their last 20 matches. */
export function detectPremades(team: LobbyTeam): PremadeGroup[] {
  const ps = team.players.map((p) => ({ id: p.rosterId, nickname: p.profile?.nickname ?? p.rosterNickname, ids: new Set(p.recent.slice(0, 20).map((r) => r.matchId)) }));
  const parent = new Map(ps.map((p) => [p.id, p.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
  const best = new Map<string, number>();
  const pairs: [string, string, number][] = [];
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      let n = 0;
      for (const id of ps[i].ids) if (ps[j].ids.has(id)) n++;
      if (n >= PREMADE_MIN_SHARED) pairs.push([ps[i].id, ps[j].id, n]);
    }
  for (const [a, b] of pairs) parent.set(find(a), find(b));
  for (const [a, , n] of pairs) best.set(find(a), Math.max(best.get(find(a)) ?? 0, n));
  const groups = new Map<string, PremadeGroup>();
  for (const p of ps) {
    const root = find(p.id);
    if (!best.has(root)) continue;
    const g = groups.get(root) ?? { faction: team.faction, players: [], sharedRecent: best.get(root)! };
    g.players.push({ id: p.id, nickname: p.nickname });
    groups.set(root, g);
  }
  return [...groups.values()].filter((g) => g.players.length >= 2).sort((a, b) => b.players.length - a.players.length);
}

/** Per-map comparison of lifetime win rates, to help with the veto. */
export function vetoTable(ours: LobbyTeam, theirs: LobbyTeam, pool: string[]): VetoRow[] {
  const side = (t: LobbyTeam, map: string) =>
    t.players.flatMap((p) => {
      const s = p.lifetime?.maps.find((m) => m.map === map);
      return s && s.matches >= MIN_MAP_SAMPLE ? [mapWr(s)] : [];
    });
  const maps = pool.length ? pool : [...new Set([...ours.players, ...theirs.players].flatMap((p) => p.lifetime?.maps.map((m) => m.map) ?? []))];
  return maps
    .map((map) => {
      const a = side(ours, map);
      const b = side(theirs, map);
      const ourWr = mean(a);
      const theirWr = mean(b);
      return { map, ourWr, theirWr, ourSample: a.length, theirSample: b.length, diff: ourWr !== null && theirWr !== null ? Math.round((ourWr - theirWr) * 10) / 10 : null };
    })
    .sort((x, y) => (y.diff ?? -999) - (x.diff ?? -999));
}

export function lobbyIntel(args: { meId: string; teams: LobbyTeam[]; history: HistoryMatch[]; mapPool: string[]; coverage: HistoryCoverage }): LobbyIntel {
  const { meId, teams, history } = args;
  const mine = teams.find((t) => t.players.some((p) => p.rosterId === meId)) ?? null;
  const myFaction = mine?.faction ?? null;
  const [a, b] = mine ? [mine, teams.find((t) => t !== mine)!] : [teams[0], teams[1]];
  return {
    myFaction,
    players: teams.flatMap((t) => playerIntel(t, myFaction, meId, history)),
    premades: teams.flatMap(detectPremades),
    veto: a && b ? vetoTable(a, b, args.mapPool) : [],
    coverage: args.coverage,
  };
}
