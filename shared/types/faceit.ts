/**
 * Normalised domain types used across the extension.
 *
 * Raw FACEIT Data API v4 payloads are parsed into these shapes by
 * `shared/utils/parse.ts`. Every numeric field that FACEIT may omit is typed
 * `number | null` — `null` means "not provided by the source", never zero.
 */

export type Faction = 'faction1' | 'faction2';

export interface PlayerProfile {
  id: string;
  nickname: string;
  avatar: string | null;
  country: string | null;
  faceitUrl: string;
  level: number | null;
  elo: number | null;
  region: string | null;
  steamNickname: string | null;
  /** epoch ms when this profile was fetched from FACEIT */
  fetchedAt: number;
}

export interface MapSegment {
  map: string;
  matches: number;
  wins: number;
  winRate: number | null;
  kd: number | null;
  kr: number | null;
  adr: number | null;
  hsPercent: number | null;
}

export interface LifetimeStats {
  playerId: string;
  matches: number | null;
  wins: number | null;
  losses: number | null;
  winRate: number | null;
  kd: number | null;
  adr: number | null;
  hsPercent: number | null;
  longestWinStreak: number | null;
  currentWinStreak: number | null;
  /** Most recent first, as reported by FACEIT ("Recent Results", usually 5). */
  recentResults: boolean[];
  maps: MapSegment[];
  fetchedAt: number;
}

/** One row of GET /players/{id}/games/cs2/stats — a player's line in one match. */
export interface MatchStatLine {
  matchId: string;
  /** epoch ms */
  finishedAt: number | null;
  map: string | null;
  win: boolean | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  kd: number | null;
  kr: number | null;
  adr: number | null;
  hsPercent: number | null;
  mvps: number | null;
  /** e.g. "13 / 9" as reported by FACEIT */
  score: string | null;
  rounds: number | null;
}

export interface RosterPlayer {
  id: string;
  nickname: string;
  avatar: string | null;
  level: number | null;
}

export interface TeamRoster {
  name: string;
  avatar: string | null;
  players: RosterPlayer[];
}

/** One row of GET /players/{id}/history. FACEIT does not include the map here. */
export interface HistoryMatch {
  matchId: string;
  /** epoch ms */
  startedAt: number;
  finishedAt: number | null;
  status: string;
  faceitUrl: string;
  competition: string | null;
  gameMode: string | null;
  winner: Faction | null;
  teams: Record<Faction, TeamRoster>;
}

export interface MatchDetails {
  matchId: string;
  status: string;
  startedAt: number | null;
  finishedAt: number | null;
  configuredAt: number | null;
  map: string | null;
  /** Maps still in the veto, if FACEIT exposes them for this match. */
  mapPool: string[];
  region: string | null;
  competition: string | null;
  faceitUrl: string;
  winner: Faction | null;
  /** Map score (series), NOT rounds. Round score comes from MatchStats. */
  seriesScore: Record<Faction, number> | null;
  teams: Record<Faction, TeamRoster>;
}

export interface PlayerMatchStat {
  playerId: string;
  nickname: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  kd: number | null;
  kr: number | null;
  adr: number | null;
  hsPercent: number | null;
  mvps: number | null;
}

export interface TeamMatchStat {
  teamId: string;
  name: string;
  win: boolean | null;
  finalScore: number | null;
  players: PlayerMatchStat[];
}

export interface MatchStats {
  matchId: string;
  map: string | null;
  score: string | null;
  rounds: number | null;
  teams: TeamMatchStat[];
}

export interface SearchHit {
  id: string;
  nickname: string;
  avatar: string | null;
  country: string | null;
  level: number | null;
  verified: boolean;
}

export interface EloSnapshot {
  t: number;
  elo: number;
}
