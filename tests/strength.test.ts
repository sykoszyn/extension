import { describe, expect, it } from 'vitest';
import { compareTeams, NORMALISERS, SPI_WEIGHTS, teamStrength } from '@shared/utils/strength';
import type { LobbyPlayer, LobbyTeam } from '@shared/types/analytics';
import type { MatchStatLine } from '@shared/types/faceit';

const lines = (n: number, win: boolean, k: number, d: number, adr: number): MatchStatLine[] =>
  Array.from({ length: n }, (_, i) => ({ matchId: `m${i}`, finishedAt: i, map: 'de_mirage', win, kills: k, deaths: d, assists: 0, kd: k / d, kr: null, adr, hsPercent: 50, mvps: 0, score: null, rounds: 24 }));

function player(elo: number | null, recent: MatchStatLine[], matches: number | null, mirageWr: number | null): LobbyPlayer {
  return {
    rosterId: Math.random().toString(), rosterNickname: 'p', rosterAvatar: null, rosterLevel: 5, error: null, recent,
    profile: elo === null ? null : { id: 'x', nickname: 'p', avatar: null, country: null, faceitUrl: '', level: 5, elo, region: null, steamNickname: null, fetchedAt: 0 },
    lifetime: matches === null ? null : { playerId: 'x', matches, wins: null, losses: null, winRate: 50, kd: 1, adr: 80, hsPercent: 50, longestWinStreak: null, currentWinStreak: null, recentResults: [], fetchedAt: 0, maps: mirageWr === null ? [] : [{ map: 'de_mirage', matches: 10, wins: 5, winRate: mirageWr, kd: 1, kr: null, adr: 80, hsPercent: 50 }] },
  };
}
const team = (players: LobbyPlayer[]): LobbyTeam => ({ faction: 'faction1', name: 't', players });

describe('SykosTracker Performance Index', () => {
  it('weights sum to 1 and normalisers clamp to 0–100', () => {
    expect(Object.values(SPI_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(NORMALISERS.elo(100)).toBe(0);
    expect(NORMALISERS.elo(5000)).toBe(100);
    expect(NORMALISERS.elo(1750)).toBe(50);
    expect(NORMALISERS.kd(1.1)).toBeCloseTo(50);
    expect(NORMALISERS.experience(3000)).toBeCloseTo(100);
  });

  it('computes the transparent formula exactly', () => {
    const t = teamStrength(team([player(1750, lines(20, true, 22, 20, 80), 3000, 60)]), 'de_mirage');
    // elo 50, kd (1.1) 50, adr (80) 50, recentWr 100, mapWr 60, exp 100
    const expected = (0.3 * 50 + 0.2 * 50 + 0.15 * 50 + 0.15 * 100 + 0.1 * 60 + 0.1 * 100) / 1;
    expect(t.index).toBeCloseTo(expected, 1);
  });

  it('drops missing components and re-normalises weights', () => {
    const t = teamStrength(team([player(1750, [], null, null)]), null);
    expect(t.components.filter((c) => c.score !== null).map((c) => c.key)).toEqual(['elo']);
    expect(t.index).toBe(50);
  });

  it('no data → null index, never a fabricated number', () => {
    expect(teamStrength(team([player(null, [], null, null)]), null).index).toBeNull();
  });

  it('strengths/weaknesses', () => {
    const a = teamStrength(team([player(2500, lines(20, true, 30, 15, 100), 2000, 70)]), 'de_mirage');
    const b = teamStrength(team([player(1200, lines(20, false, 10, 20, 60), 2000, 40)]), 'de_mirage');
    const c = compareTeams(a, b);
    expect(c.strengths).toContain('ELO');
    expect(c.weaknesses).toEqual([]);
    expect(a.index!).toBeGreaterThan(b.index!);
  });
});
