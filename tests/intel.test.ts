import { describe, expect, it } from 'vitest';
import { detectPremades, lobbyIntel, vetoTable } from '@shared/utils/intel';
import { parseHistoryItem } from '@shared/utils/parse';
import type { LobbyPlayer, LobbyTeam } from '@shared/types/analytics';
import type { MatchStatLine } from '@shared/types/faceit';
import { handle, ME, RIVAL, MATCHES } from './fixtures/mock-faceit.mjs';

const history = [0, 100, 200].flatMap((off) => handle(`/players/${ME.id}/history`, { from: 0, offset: off, limit: 100 }).body.items.map((i: any) => parseHistoryItem(i)!));
const line = (id: string): MatchStatLine => ({ matchId: id, finishedAt: 1, map: 'de_mirage', win: true, kills: 20, deaths: 10, assists: 0, kd: 2, kr: null, adr: 90, hsPercent: 50, mvps: 0, score: null, rounds: 24 });

function lp(id: string, matchIds: string[] = [], maps: [string, number, number][] = []): LobbyPlayer {
  return {
    rosterId: id, rosterNickname: id, rosterAvatar: null, rosterLevel: 5, profile: null, error: null,
    recent: matchIds.map(line),
    lifetime: { playerId: id, matches: 100, wins: 50, losses: 50, winRate: 50, kd: 1, adr: 80, hsPercent: 50, longestWinStreak: null, currentWinStreak: null, recentResults: [], fetchedAt: 0,
      maps: maps.map(([map, matches, winRate]) => ({ map, matches, wins: Math.round((matches * winRate) / 100), winRate, kd: 1, kr: null, adr: 80, hsPercent: 50 })) },
  };
}
const team = (faction: 'faction1' | 'faction2', players: LobbyPlayer[]): LobbyTeam => ({ faction, name: faction, players });

describe('Enemy Intelligence', () => {
  it('reports past encounters with each lobby player from local history', () => {
    const teams = [team('faction1', [lp(ME.id), lp('x')]), team('faction2', [lp(RIVAL.id)])];
    const intel = lobbyIntel({ meId: ME.id, teams, history, mapPool: [], coverage: { scanned: history.length, oldest: null, newest: null, complete: true, updatedAt: 1 } });
    expect(intel.myFaction).toBe('faction1');
    const rival = intel.players.find((p) => p.playerId === RIVAL.id)!;
    expect(rival.side).toBe('enemy');
    expect(rival.shared.count).toBe(MATCHES.filter((_: unknown, i: number) => i % 4 === 0).length);
    expect(rival.asEnemies.count).toBe(MATCHES.filter((_: unknown, i: number) => i % 8 === 0).length);
    expect(rival.lastMet).toBe(MATCHES[0].started * 1000);
    expect(intel.players.find((p) => p.playerId === 'x')!.side).toBe('teammate');
    expect(intel.players.some((p) => p.playerId === ME.id)).toBe(false);
  });

  it('best/worst maps only from samples ≥ 5', () => {
    const t = team('faction2', [lp('a', [], [['de_mirage', 20, 70], ['de_nuke', 3, 100], ['de_inferno', 10, 40]])]);
    const [p] = lobbyIntel({ meId: 'me', teams: [team('faction1', []), t], history: [], mapPool: [], coverage: { scanned: 0, oldest: null, newest: null, complete: false, updatedAt: null } }).players;
    expect(p.bestMaps.map((m) => m.map)).toEqual(['de_mirage', 'de_inferno']);
    expect(p.worstMap?.map).toBe('de_inferno');
    expect(p.side).toBeNull();
  });

  it('detects possible premades from shared recent match ids', () => {
    const shared = ['m1', 'm2', 'm3', 'm4'];
    const t = team('faction2', [lp('a', [...shared, 'a1']), lp('b', [...shared, 'b1']), lp('c', ['m1', 'm2', 'm3', 'c1']), lp('d', ['m1', 'd1'])]);
    const g = detectPremades(t);
    expect(g).toHaveLength(1);
    expect(g[0].players.map((p) => p.id).sort()).toEqual(['a', 'b', 'c']);
    expect(g[0].sharedRecent).toBe(4);
  });

  it('veto table compares mean lifetime win rates and sorts by advantage', () => {
    const ours = team('faction1', [lp('a', [], [['de_mirage', 10, 60], ['de_nuke', 10, 40]])]);
    const theirs = team('faction2', [lp('b', [], [['de_mirage', 10, 50], ['de_nuke', 10, 55]])]);
    const v = vetoTable(ours, theirs, ['de_mirage', 'de_nuke', 'de_train']);
    expect(v[0]).toMatchObject({ map: 'de_mirage', diff: 10 });
    expect(v[1]).toMatchObject({ map: 'de_nuke', diff: -15 });
    expect(v[2]).toMatchObject({ map: 'de_train', diff: null, ourSample: 0 });
  });
});
