import { describe, expect, it } from 'vitest';
import { num, parseHistoryItem, parseLifetime, parseMatch, parseMatchStatLine, parseMatchStats, parsePlayer, toMs } from '@shared/utils/parse';
import { normalizeMap, mapLabel } from '@shared/utils/maps';
import { handle, ME, MATCHES, LIVE_MATCH_ID } from './fixtures/mock-faceit.mjs';

describe('primitive parsing', () => {
  it('parses FACEIT numeric strings without inventing values', () => {
    expect(num('1.12')).toBe(1.12);
    expect(num('53%')).toBe(53);
    expect(num('')).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num('abc')).toBeNull();
  });
  it('normalises seconds and ms timestamps', () => {
    expect(toMs(1700000000)).toBe(1700000000000);
    expect(toMs(1700000000000)).toBe(1700000000000);
    expect(toMs(0)).toBeNull();
  });
  it('normalises map names', () => {
    expect(normalizeMap('Mirage')).toBe('de_mirage');
    expect(normalizeMap('DE_DUST2')).toBe('de_dust2');
    expect(normalizeMap('Dust II')).toBe('de_dust2');
    expect(normalizeMap('de_newmap')).toBe('de_newmap');
    expect(mapLabel('de_newmap')).toBe('Newmap');
  });
});

describe('endpoint parsers', () => {
  it('player', () => {
    const p = parsePlayer(handle('/players', { nickname: 'sykos' }).body, 1);
    expect(p).toMatchObject({ id: ME.id, nickname: 'Sykos', level: expect.any(Number), elo: expect.any(Number), country: 'es' });
    expect(p.faceitUrl).not.toContain('{lang}');
  });
  it('player without cs2 keeps nulls (no fake zeros)', () => {
    const p = parsePlayer({ player_id: 'x', nickname: 'n', games: {} });
    expect(p.elo).toBeNull();
    expect(p.level).toBeNull();
  });
  it('lifetime + segments', () => {
    const l = parseLifetime(handle(`/players/${ME.id}/stats/cs2`).body);
    expect(l.matches).toBeGreaterThan(0);
    expect(l.losses).toBe(l.matches! - l.wins!);
    expect(l.recentResults).toEqual([true, false, true, true, false]);
    expect(l.maps.length).toBeGreaterThan(0);
    expect(l.maps[0].map.startsWith('de_')).toBe(true);
  });
  it('empty lifetime yields nulls', () => {
    const l = parseLifetime({ player_id: 'x' });
    expect(l.matches).toBeNull();
    expect(l.kd).toBeNull();
    expect(l.maps).toEqual([]);
  });
  it('match stat lines', () => {
    const raw = handle(`/players/${ME.id}/games/cs2/stats`, { limit: 5 }).body.items[0];
    const l = parseMatchStatLine(raw)!;
    expect(l.matchId).toBe(MATCHES[0].id);
    expect(l.map).toBe(MATCHES[0].map);
    expect(typeof l.win).toBe('boolean');
    expect(l.finishedAt).toBe(MATCHES[0].finished * 1000);
  });
  it('derives K/D from kills/deaths when ratio missing', () => {
    expect(parseMatchStatLine({ stats: { 'Match Id': 'm', Kills: '20', Deaths: '10' } })!.kd).toBe(2);
  });
  it('history item with rosters', () => {
    const h = parseHistoryItem(handle(`/players/${ME.id}/history`, { from: 0, limit: 1 }).body.items[0])!;
    expect(h.teams.faction1.players).toHaveLength(5);
    expect(h.teams.faction2.players).toHaveLength(5);
    expect(h.startedAt).toBe(MATCHES[0].started * 1000);
    expect(['faction1', 'faction2']).toContain(h.winner);
  });
  it('match room with picked map', () => {
    const m = parseMatch(handle(`/matches/${LIVE_MATCH_ID}`).body);
    expect(m.map).toBe('de_mirage');
    expect(m.status).toBe('READY');
    expect(m.mapPool.length).toBeGreaterThan(3);
    expect(m.teams.faction1.players).toHaveLength(5);
  });
  it('match stats scoreboard', () => {
    const s = parseMatchStats(handle(`/matches/${MATCHES[0].id}/stats`).body, MATCHES[0].id)!;
    expect(s.map).toBe(MATCHES[0].map);
    expect(s.teams).toHaveLength(2);
    expect(s.teams[0].players).toHaveLength(5);
    expect(parseMatchStats({}, 'x')).toBeNull();
  });
});
