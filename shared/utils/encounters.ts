/**
 * "Have I played with/against this player?" — from the user's match history
 * stored locally (the Rival-Tracker style badge in the match room).
 */
import type { HistoryMatch } from '../types/faceit';
import { factionOf } from './analytics';

export interface Encounter {
  /** times on the opposite team, and the user's record in those */
  rival: { count: number; wins: number; losses: number };
  /** times on the same team */
  together: number;
  last: number | null;
}

export function encountersFor(history: HistoryMatch[], meId: string, ids: string[]): Record<string, Encounter> {
  const out: Record<string, Encounter> = {};
  for (const id of ids) if (id !== meId) out[id] = { rival: { count: 0, wins: 0, losses: 0 }, together: 0, last: null };
  for (const m of history) {
    const mine = factionOf(m, meId);
    if (!mine) continue;
    for (const id of Object.keys(out)) {
      const theirs = factionOf(m, id);
      if (!theirs) continue;
      const e = out[id];
      e.last = Math.max(e.last ?? 0, m.startedAt);
      if (theirs === mine) e.together++;
      else {
        e.rival.count++;
        if (m.winner === mine) e.rival.wins++;
        else if (m.winner) e.rival.losses++;
      }
    }
  }
  return out;
}

/** Today's matches (local day) from most-recent-first stat lines. */
export function todaySession<T extends { finishedAt: number | null; win: boolean | null; kills: number | null; deaths: number | null }>(lines: T[], now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const today = lines.filter((l) => l.finishedAt !== null && l.finishedAt >= start.getTime());
  const k = today.reduce((a, l) => a + (l.kills ?? 0), 0);
  const d = today.reduce((a, l) => a + (l.deaths ?? 0), 0);
  return {
    matches: today.length,
    wins: today.filter((l) => l.win === true).length,
    losses: today.filter((l) => l.win === false).length,
    kd: today.length && d ? Math.round((k / d) * 100) / 100 : null,
  };
}
