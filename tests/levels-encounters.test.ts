import { describe, expect, it } from 'vitest';
import { levelProgress } from '@shared/utils/levels';
import { encountersFor, todaySession } from '@shared/utils/encounters';
import { parseHistoryItem } from '@shared/utils/parse';
import { handle, ME, RIVAL, MATCHES } from './fixtures/mock-faceit.mjs';

describe('level progress (CS2 thresholds)', () => {
  it('matches real level/ELO pairs seen on FACEIT', () => {
    // pairs observed from the live Data API: 5:1151, 7:1354, 8:1552, 9:1751+, 10:2016
    expect(levelProgress(1151)!.level).toBe(5);
    expect(levelProgress(1354)!.level).toBe(7);
    expect(levelProgress(1552)!.level).toBe(8);
    expect(levelProgress(1782)!.level).toBe(9);
    expect(levelProgress(2016)!.level).toBe(10);
  });
  it('ELO to next level and distance to the floor', () => {
    expect(levelProgress(1700)).toMatchObject({ level: 8, toNext: 51, aboveFloor: 169, nextLevel: 9 });
    expect(levelProgress(1531)).toMatchObject({ level: 8, aboveFloor: 0, pct: 0 });
    expect(levelProgress(2269)).toMatchObject({ level: 10, toNext: null, aboveFloor: 268, pct: 100 });
    expect(levelProgress(null)).toBeNull();
  });
});

describe('encounters (Rival-Tracker badge)', () => {
  const history = [0, 100, 200].flatMap((off) => handle(`/players/${ME.id}/history`, { from: 0, offset: off, limit: 100 }).body.items.map((i: any) => parseHistoryItem(i)!));
  it('counts rival and teammate meetings from my point of view', () => {
    const e = encountersFor(history, ME.id, [ME.id, RIVAL.id, 'nobody'])!;
    const rivalMatches = MATCHES.filter((_: unknown, i: number) => i % 8 === 0);
    const myWins = rivalMatches.filter((m: any) => (m.teams.faction1.includes(ME.id) ? 'faction1' : 'faction2') === m.winner).length;
    expect(e[RIVAL.id].rival).toEqual({ count: rivalMatches.length, wins: myWins, losses: rivalMatches.length - myWins });
    expect(e[RIVAL.id].together).toBe(MATCHES.filter((_: unknown, i: number) => i % 4 === 0).length - rivalMatches.length);
    expect(e.nobody).toEqual({ rival: { count: 0, wins: 0, losses: 0 }, together: 0, last: null });
    expect(e).not.toHaveProperty(ME.id);
  });
});

describe('today session', () => {
  it('only counts matches finished today', () => {
    const now = new Date(2026, 10, 5, 22, 0).getTime();
    const at = (h: number, day = 5) => new Date(2026, 10, day, h).getTime();
    const s = todaySession(
      [
        { finishedAt: at(21), win: true, kills: 20, deaths: 10 },
        { finishedAt: at(19), win: false, kills: 10, deaths: 20 },
        { finishedAt: at(23, 4), win: true, kills: 30, deaths: 5 },
      ],
      now,
    );
    expect(s).toEqual({ matches: 2, wins: 1, losses: 1, kd: 1 });
  });
});
