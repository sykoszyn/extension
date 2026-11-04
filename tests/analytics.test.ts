import { describe, expect, it } from 'vitest';
import { aggregateKd, computePvp, currentStreak, findSharedMatches, formSummary, longestStreak, mapWindowStats, mergeHistory, record } from '@shared/utils/analytics';
import { parseHistoryItem, parseMatchStatLine, parseMatchStats } from '@shared/utils/parse';
import type { HistoryMatch, MatchStatLine, MatchStats } from '@shared/types/faceit';
import { handle, ME, RIVAL, MATCHES } from './fixtures/mock-faceit.mjs';

const history: HistoryMatch[] = [0, 100, 200].flatMap((off) =>
  handle(`/players/${ME.id}/history`, { from: 0, offset: off, limit: 100 }).body.items.map((i: any) => parseHistoryItem(i)!),
);
const line = (win: boolean | null, map = 'de_mirage', k = 20, d = 10, adr = 80): MatchStatLine => ({
  matchId: Math.random().toString(), finishedAt: 1, map, win, kills: k, deaths: d, assists: 0, kd: k / d, kr: null, adr, hsPercent: 50, mvps: 0, score: null, rounds: 24,
});

describe('records & streaks', () => {
  it('record ignores undecided matches in win rate', () => {
    expect(record([true, false, null, true])).toEqual({ count: 4, wins: 2, losses: 1, winRate: 66.7 });
    expect(record([]).winRate).toBeNull();
  });
  it('current and longest streaks', () => {
    expect(currentStreak([true, true, false, true])).toEqual({ type: 'win', length: 2 });
    expect(currentStreak([null, false, false, true])).toEqual({ type: 'loss', length: 2 });
    expect(currentStreak([])).toEqual({ type: null, length: 0 });
    expect(longestStreak([true, false, true, true, true, false], true)).toBe(3);
  });
  it('aggregate K/D is Σk/Σd, not mean of ratios', () => {
    expect(aggregateKd([{ kills: 30, deaths: 10 }, { kills: 10, deaths: 30 }])).toBe(1);
  });
});

describe('form & map windows', () => {
  it('form summary', () => {
    const f = formSummary([line(true, 'de_mirage', 20, 10, 90), line(false, 'de_nuke', 10, 20, 70)]);
    expect(f).toMatchObject({ matches: 2, wins: 1, losses: 1, winRate: 50, kd: 1, adr: 80 });
  });
  it('per-map stats incl. map streaks', () => {
    const ls = [line(true), line(true), line(false, 'de_nuke'), line(false), line(true)];
    const mir = mapWindowStats(ls).find((m) => m.map === 'de_mirage')!;
    expect(mir).toMatchObject({ matches: 4, wins: 3, losses: 1, winRate: 75, longestWinStreak: 2 });
    expect(mir.currentStreak).toEqual({ type: 'win', length: 2 });
  });
  it('real fixture lines', () => {
    const ls = handle(`/players/${ME.id}/games/cs2/stats`, { limit: 20 }).body.items.map((i: any) => parseMatchStatLine(i)!);
    const maps = mapWindowStats(ls);
    expect(maps.reduce((a, m) => a + m.matches, 0)).toBe(20);
  });
});

describe('Player vs Player', () => {
  it('distinguishes shared, teammate and enemy matches', () => {
    const shared = findSharedMatches(history, ME.id, RIVAL.id);
    const expectedShared = MATCHES.filter((_: unknown, i: number) => i % 4 === 0).length;
    const expectedEnemy = MATCHES.filter((_: unknown, i: number) => i % 8 === 0).length;
    expect(shared).toHaveLength(expectedShared);
    expect(shared.filter((s) => s.relation === 'enemy')).toHaveLength(expectedEnemy);
    expect(shared.filter((s) => s.relation === 'teammate')).toHaveLength(expectedShared - expectedEnemy);
  });

  it('computes H2H record from my perspective and averages only enemy matches', () => {
    const statsById: Record<string, MatchStats> = {};
    for (const m of MATCHES.slice(0, 40)) statsById[m.id] = parseMatchStats(handle(`/matches/${m.id}/stats`).body, m.id)!;
    const r = computePvp({ meId: ME.id, otherId: RIVAL.id, history, statsById, coverage: { scanned: history.length, oldest: null, newest: null, complete: true, updatedAt: 1 } });
    const truthEnemy = MATCHES.filter((_: unknown, i: number) => i % 8 === 0);
    const myWins = truthEnemy.filter((m: any) => (m.teams.faction1.includes(ME.id) ? 'faction1' : 'faction2') === m.winner).length;
    expect(r.asEnemies.count).toBe(truthEnemy.length);
    expect(r.asEnemies.wins).toBe(myWins);
    expect(r.asEnemies.losses).toBe(truthEnemy.length - myWins);
    expect(r.shared.count).toBe(r.asEnemies.count + r.asTeammates.count);
    expect(r.meVsAvg.sample).toBe(5); // enemy matches among first 40: i = 0,8,16,24,32
    expect(r.statsLoaded).toBe(10); // shared matches among first 40
    expect(r.timeline[0].startedAt).toBeGreaterThanOrEqual(r.timeline[1].startedAt);
    expect(r.lastFaced).toBe(MATCHES[0].started * 1000);
    expect(r.maps.length).toBeGreaterThan(0);
  });

  it('period filter', () => {
    const since = MATCHES[30].started * 1000;
    const r = computePvp({ meId: ME.id, otherId: RIVAL.id, history, statsById: {}, coverage: { scanned: 0, oldest: null, newest: null, complete: false, updatedAt: null }, since });
    expect(r.shared.count).toBe(8); // i = 0,4,...,28
    expect(r.meVsAvg.kd).toBeNull(); // no stats loaded → no invented numbers
  });

  it('no shared matches → zero counts, null rates', () => {
    const r = computePvp({ meId: ME.id, otherId: 'nobody', history, statsById: {}, coverage: { scanned: 0, oldest: null, newest: null, complete: true, updatedAt: null } });
    expect(r.shared.count).toBe(0);
    expect(r.asEnemies.winRate).toBeNull();
    expect(r.lastFaced).toBeNull();
  });

  it('mergeHistory dedupes and sorts newest first', () => {
    const merged = mergeHistory(history.slice(0, 10), history.slice(5, 15));
    expect(merged).toHaveLength(15);
    expect(merged[0].startedAt).toBeGreaterThan(merged[14].startedAt);
  });
});
