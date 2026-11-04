import type { Faction, HistoryMatch, LifetimeStats, MatchStatLine, PlayerProfile } from './faceit';

export interface Record3 {
  count: number;
  wins: number;
  losses: number;
  /** 0–100, null when count is 0 */
  winRate: number | null;
}

/** Per-match stat line for one player inside a PvP-relevant match. */
export interface PvpStatLine {
  kills: number | null;
  deaths: number | null;
  kd: number | null;
  adr: number | null;
  hsPercent: number | null;
}

export interface PvpMatch {
  matchId: string;
  startedAt: number;
  faceitUrl: string;
  relation: 'teammate' | 'enemy';
  /** From "me"'s perspective. null when the match has no result (cancelled…). */
  myWin: boolean | null;
  myFaction: Faction;
  map: string | null;
  score: string | null;
  me: PvpStatLine | null;
  other: PvpStatLine | null;
}

export interface Averages {
  kd: number | null;
  adr: number | null;
  hsPercent: number | null;
  /** number of matches that contributed (stats can be missing for some) */
  sample: number;
}

export interface PvpResult {
  meId: string;
  otherId: string;
  shared: Record3;
  asTeammates: Record3;
  asEnemies: Record3;
  /** Averages computed only over matches where they were ENEMIES. */
  meVsAvg: Averages;
  otherVsAvg: Averages;
  maps: { map: string; enemy: number; teammate: number; enemyWins: number; enemyLosses: number }[];
  lastTogether: number | null;
  lastFaced: number | null;
  timeline: PvpMatch[];
  coverage: HistoryCoverage;
  /** shared matches for which per-match stats (map/K/D/ADR) were loaded */
  statsLoaded: number;
}

export interface HistoryCoverage {
  scanned: number;
  /** epoch ms of the oldest scanned match, null if none */
  oldest: number | null;
  newest: number | null;
  /** true when the full CS2 history of the player has been scanned */
  complete: boolean;
  updatedAt: number | null;
}

export interface StreakInfo {
  type: 'win' | 'loss' | null;
  length: number;
}

export interface MapWindowStats {
  map: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  kd: number | null;
  adr: number | null;
  hsPercent: number | null;
  currentStreak: StreakInfo;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface FormSummary {
  matches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  kd: number | null;
  kr: number | null;
  adr: number | null;
  hsPercent: number | null;
  avgKills: number | null;
}

export interface LobbyPlayer {
  profile: PlayerProfile | null;
  rosterId: string;
  rosterNickname: string;
  rosterAvatar: string | null;
  rosterLevel: number | null;
  lifetime: LifetimeStats | null;
  recent: MatchStatLine[];
  error: string | null;
}

export interface LobbyTeam {
  faction: Faction;
  name: string;
  players: LobbyPlayer[];
}

export interface StrengthComponent {
  key: 'elo' | 'kd' | 'adr' | 'recentWr' | 'mapWr' | 'experience';
  label: string;
  weight: number;
  /** raw team average, null when no player had the data */
  raw: number | null;
  /** 0–100 normalised */
  score: number | null;
}

export interface TeamStrength {
  faction: Faction;
  /** 0–100, SykosTracker Performance Index. NOT a win probability. */
  index: number | null;
  components: StrengthComponent[];
  avgElo: number | null;
  avgLifetimeWinRate: number | null;
  avgRecentKd: number | null;
  avgRecentAdr: number | null;
  avgRecentWinRate: number | null;
  avgMapWinRate: number | null;
  totalMatches: number | null;
  /** number of players with usable data */
  coverage: number;
}

export type { HistoryMatch };

// ───────────── Enemy Intelligence ─────────────

export interface PlayerIntel {
  playerId: string;
  nickname: string;
  faction: Faction;
  /** Relative to the user. null when the user is not in this lobby. */
  side: 'enemy' | 'teammate' | null;
  /** From the user's locally discovered history. */
  shared: Record3;
  asEnemies: Record3;
  asTeammates: Record3;
  lastMet: number | null;
  /** Lifetime maps with ≥ MIN_MAP_SAMPLE matches, best win rate first. */
  bestMaps: { map: string; matches: number; winRate: number }[];
  worstMap: { map: string; matches: number; winRate: number } | null;
  recentKd: number | null;
  recentAdr: number | null;
  recentWinRate: number | null;
  recentMatches: number;
}

export interface PremadeGroup {
  faction: Faction;
  players: { id: string; nickname: string }[];
  /** Highest number of shared matches between two members within their last 20 games. */
  sharedRecent: number;
}

export interface VetoRow {
  map: string;
  /** Team mean lifetime win rate on the map (players with ≥ MIN_MAP_SAMPLE matches). */
  ourWr: number | null;
  theirWr: number | null;
  ourSample: number;
  theirSample: number;
  /** ourWr − theirWr, null when either side lacks data. */
  diff: number | null;
}

export interface LobbyIntel {
  myFaction: Faction | null;
  players: PlayerIntel[];
  premades: PremadeGroup[];
  veto: VetoRow[];
  coverage: HistoryCoverage;
}
