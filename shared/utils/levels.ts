/**
 * FACEIT CS2 skill levels by ELO (current CS2 thresholds, verified against
 * real player data: level/elo pairs returned by the Data API).
 */
export const LEVELS: { level: number; min: number; max: number | null }[] = [
  { level: 1, min: 100, max: 500 },
  { level: 2, min: 501, max: 750 },
  { level: 3, min: 751, max: 900 },
  { level: 4, min: 901, max: 1050 },
  { level: 5, min: 1051, max: 1200 },
  { level: 6, min: 1201, max: 1350 },
  { level: 7, min: 1351, max: 1530 },
  { level: 8, min: 1531, max: 1750 },
  { level: 9, min: 1751, max: 2000 },
  { level: 10, min: 2001, max: null },
];

export interface LevelProgress {
  level: number;
  /** ELO needed to reach the next level; null at level 10. */
  toNext: number | null;
  /** ELO that would drop you a level (distance to the current level's floor). */
  aboveFloor: number;
  /** 0–100 progress inside the current level; 100 at level 10. */
  pct: number;
  nextLevel: number | null;
}

export function levelProgress(elo: number | null | undefined): LevelProgress | null {
  if (elo === null || elo === undefined || !Number.isFinite(elo)) return null;
  const band = [...LEVELS].reverse().find((l) => elo >= l.min) ?? LEVELS[0];
  if (band.max === null) return { level: band.level, toNext: null, aboveFloor: elo - band.min, pct: 100, nextLevel: null };
  const span = band.max - band.min + 1;
  return {
    level: band.level,
    toNext: band.max + 1 - elo,
    aboveFloor: elo - band.min,
    pct: Math.max(0, Math.min(100, Math.round(((elo - band.min) / span) * 100))),
    nextLevel: band.level + 1,
  };
}
