/**
 * Defensive parsers: FACEIT Data API v4 raw JSON → normalised domain types.
 *
 * FACEIT returns most stats as strings ("1.12", "53") and the key names have
 * changed between CS:GO and CS2 (e.g. "Average K/D Ratio" vs "K/D Ratio").
 * Every reader therefore accepts several candidate keys and returns `null`
 * when nothing usable is present. Nothing here fabricates a value.
 */
import type {
  Faction,
  HistoryMatch,
  LifetimeStats,
  MapSegment,
  MatchDetails,
  MatchStatLine,
  MatchStats,
  PlayerMatchStat,
  PlayerProfile,
  RosterPlayer,
  SearchHit,
  TeamRoster,
} from '../types/faceit';
import { GAME_ID } from '../constants';
import { isCompetitiveMap, normalizeMap } from './maps';

type Raw = Record<string, any>;

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.').replace('%', '').trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** First numeric value among candidate keys. */
export function pickNum(obj: Raw | undefined | null, ...keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const n = num(obj[k]);
    if (n !== null) return n;
  }
  return null;
}

function pickStr(obj: Raw | undefined | null, ...keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return null;
}

/** FACEIT uses seconds in some endpoints and ms in others. Normalise to ms. */
export function toMs(v: unknown): number | null {
  const n = num(v);
  if (n === null) {
    if (typeof v === 'string') {
      const d = Date.parse(v);
      return Number.isFinite(d) ? d : null;
    }
    return null;
  }
  if (n <= 0) return null;
  return n < 1e12 ? n * 1000 : n;
}

/** FACEIT URLs contain a `{lang}` placeholder. */
export function fixFaceitUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  return url.replace('{lang}', 'en');
}

export function parsePlayer(raw: Raw, now = Date.now()): PlayerProfile {
  const game: Raw = raw?.games?.[GAME_ID] ?? {};
  const nickname = String(raw.nickname ?? '');
  return {
    id: String(raw.player_id ?? ''),
    nickname,
    avatar: raw.avatar || null,
    country: typeof raw.country === 'string' && raw.country ? raw.country.toLowerCase() : null,
    faceitUrl: fixFaceitUrl(raw.faceit_url, `https://www.faceit.com/en/players/${encodeURIComponent(nickname)}`),
    level: num(game.skill_level),
    elo: num(game.faceit_elo),
    region: game.region || null,
    steamNickname: game.game_player_name || raw.steam_nickname || null,
    fetchedAt: now,
  };
}

function parseSegment(seg: Raw): MapSegment | null {
  if (!seg || (seg.type && String(seg.type).toLowerCase() !== 'map')) return null;
  const s: Raw = seg.stats ?? {};
  const label = normalizeMap(seg.label ?? seg.map ?? null);
  if (!label) return null;
  const matches = pickNum(s, 'Matches') ?? 0;
  const wins = pickNum(s, 'Wins') ?? 0;
  return {
    map: label,
    matches,
    wins,
    winRate: pickNum(s, 'Win Rate %'),
    kd: pickNum(s, 'Average K/D Ratio', 'K/D Ratio'),
    kr: pickNum(s, 'Average K/R Ratio', 'K/R Ratio'),
    adr: pickNum(s, 'ADR', 'Average ADR'),
    hsPercent: pickNum(s, 'Average Headshots %', 'Headshots %', 'Total Headshots %'),
  };
}

export function parseLifetime(raw: Raw, now = Date.now()): LifetimeStats {
  const l: Raw = raw?.lifetime ?? {};
  const matches = pickNum(l, 'Matches', 'Total Matches');
  const wins = pickNum(l, 'Wins');
  const recent: unknown[] = Array.isArray(l['Recent Results']) ? l['Recent Results'] : [];
  // Merge segments by map: FACEIT can return one segment per mode (5v5, 2v2…).
  const maps = new Map<string, MapSegment>();
  for (const seg of Array.isArray(raw?.segments) ? raw.segments : []) {
    const p = parseSegment(seg);
    if (!p || !isCompetitiveMap(p.map)) continue; // only competitive maps (no aim/AWP/1v1 maps)
    const mode = String(seg.mode ?? '5v5');
    if (mode !== '5v5' && maps.has(p.map)) continue;
    if (mode === '5v5' || !maps.has(p.map)) maps.set(p.map, p);
  }
  return {
    playerId: String(raw?.player_id ?? ''),
    matches,
    wins,
    losses: matches !== null && wins !== null ? Math.max(0, matches - wins) : null,
    winRate: pickNum(l, 'Win Rate %'),
    kd: pickNum(l, 'Average K/D Ratio', 'K/D Ratio'),
    adr: pickNum(l, 'ADR', 'Average ADR'),
    hsPercent: pickNum(l, 'Average Headshots %', 'Total Headshots %'),
    longestWinStreak: pickNum(l, 'Longest Win Streak'),
    currentWinStreak: pickNum(l, 'Current Win Streak'),
    recentResults: recent.map((r) => String(r) === '1'),
    maps: [...maps.values()].sort((a, b) => b.matches - a.matches),
    fetchedAt: now,
  };
}

export function parseMatchStatLine(item: Raw): MatchStatLine | null {
  const s: Raw = item?.stats ?? item;
  const matchId = pickStr(s, 'Match Id', 'Match ID', 'match_id');
  if (!matchId) return null;
  const result = pickStr(s, 'Result');
  const kills = pickNum(s, 'Kills');
  const deaths = pickNum(s, 'Deaths');
  let kd = pickNum(s, 'K/D Ratio');
  if (kd === null && kills !== null && deaths !== null) kd = deaths === 0 ? kills : round2(kills / deaths);
  return {
    matchId,
    finishedAt: toMs(s['Match Finished At'] ?? s['Updated At'] ?? s['Created At']),
    map: normalizeMap(pickStr(s, 'Map')),
    win: result === null ? null : result === '1',
    kills,
    deaths,
    assists: pickNum(s, 'Assists'),
    kd,
    kr: pickNum(s, 'K/R Ratio'),
    adr: pickNum(s, 'ADR'),
    hsPercent: pickNum(s, 'Headshots %'),
    mvps: pickNum(s, 'MVPs'),
    score: pickStr(s, 'Score'),
    rounds: pickNum(s, 'Rounds'),
  };
}

function parseRosterPlayer(p: Raw): RosterPlayer {
  return {
    id: String(p.player_id ?? p.id ?? ''),
    nickname: String(p.nickname ?? p.game_player_name ?? ''),
    avatar: p.avatar || null,
    level: num(p.skill_level ?? p.game_skill_level),
  };
}

function parseTeam(t: Raw | undefined, listKey: 'players' | 'roster', fallbackName: string): TeamRoster {
  const list: Raw[] = Array.isArray(t?.[listKey]) ? t![listKey] : Array.isArray(t?.players) ? t!.players : [];
  return {
    name: String(t?.nickname ?? t?.name ?? fallbackName),
    avatar: t?.avatar || null,
    players: list.map(parseRosterPlayer).filter((p) => p.id),
  };
}

function parseWinner(v: unknown): Faction | null {
  return v === 'faction1' || v === 'faction2' ? v : null;
}

export function parseHistoryItem(raw: Raw): HistoryMatch | null {
  if (!raw?.match_id) return null;
  const id = String(raw.match_id);
  return {
    matchId: id,
    startedAt: toMs(raw.started_at) ?? toMs(raw.finished_at) ?? 0,
    finishedAt: toMs(raw.finished_at),
    status: String(raw.status ?? 'unknown').toLowerCase(),
    faceitUrl: fixFaceitUrl(raw.faceit_url, matchUrl(id)),
    competition: raw.competition_name || null,
    gameMode: raw.game_mode || null,
    winner: parseWinner(raw.results?.winner),
    teams: {
      faction1: parseTeam(raw.teams?.faction1, 'players', 'Team 1'),
      faction2: parseTeam(raw.teams?.faction2, 'players', 'Team 2'),
    },
  };
}

export function parseMatch(raw: Raw): MatchDetails {
  const id = String(raw.match_id ?? '');
  const pick: unknown = raw?.voting?.map?.pick;
  const entities: Raw[] = Array.isArray(raw?.voting?.map?.entities) ? raw.voting.map.entities : [];
  const picked = Array.isArray(pick) && pick.length ? String(pick[0]) : null;
  const pickedEntity = picked ? entities.find((e) => e.guid === picked || e.game_map_id === picked || e.name === picked) : null;
  const score = raw?.results?.score;
  return {
    matchId: id,
    status: String(raw.status ?? 'unknown').toUpperCase(),
    startedAt: toMs(raw.started_at),
    finishedAt: toMs(raw.finished_at),
    configuredAt: toMs(raw.configured_at),
    map: normalizeMap(pickedEntity?.class_name ?? pickedEntity?.game_map_id ?? picked),
    mapPool: entities.map((e) => normalizeMap(e.class_name ?? e.game_map_id ?? e.name)).filter((m): m is string => !!m),
    region: raw.region || null,
    competition: raw.competition_name || null,
    faceitUrl: fixFaceitUrl(raw.faceit_url, matchUrl(id)),
    winner: parseWinner(raw?.results?.winner),
    seriesScore:
      score && num(score.faction1) !== null && num(score.faction2) !== null
        ? { faction1: num(score.faction1)!, faction2: num(score.faction2)! }
        : null,
    teams: {
      faction1: parseTeam(raw.teams?.faction1, 'roster', 'Team 1'),
      faction2: parseTeam(raw.teams?.faction2, 'roster', 'Team 2'),
    },
  };
}

function parsePlayerMatchStat(p: Raw): PlayerMatchStat {
  const s: Raw = p.player_stats ?? {};
  return {
    playerId: String(p.player_id ?? ''),
    nickname: String(p.nickname ?? ''),
    kills: pickNum(s, 'Kills'),
    deaths: pickNum(s, 'Deaths'),
    assists: pickNum(s, 'Assists'),
    kd: pickNum(s, 'K/D Ratio'),
    kr: pickNum(s, 'K/R Ratio'),
    adr: pickNum(s, 'ADR'),
    hsPercent: pickNum(s, 'Headshots %'),
    mvps: pickNum(s, 'MVPs'),
  };
}

/** Uses the first round (map) of the series — FACEIT CS2 matchmaking is BO1. */
export function parseMatchStats(raw: Raw, matchId: string): MatchStats | null {
  const round: Raw | undefined = Array.isArray(raw?.rounds) ? raw.rounds[0] : undefined;
  if (!round) return null;
  const rs: Raw = round.round_stats ?? {};
  return {
    matchId,
    map: normalizeMap(pickStr(rs, 'Map')),
    score: pickStr(rs, 'Score'),
    rounds: pickNum(rs, 'Rounds'),
    teams: (Array.isArray(round.teams) ? round.teams : []).map((t: Raw) => {
      const ts: Raw = t.team_stats ?? {};
      const win = pickStr(ts, 'Team Win');
      return {
        teamId: String(t.team_id ?? ''),
        name: String(ts.Team ?? t.team_id ?? ''),
        win: win === null ? null : win === '1',
        finalScore: pickNum(ts, 'Final Score'),
        players: (Array.isArray(t.players) ? t.players : []).map(parsePlayerMatchStat),
      };
    }),
  };
}

export function parseSearchHit(raw: Raw): SearchHit {
  const games: Raw[] = Array.isArray(raw.games) ? raw.games : [];
  const cs2 = games.find((g) => g.name === GAME_ID);
  return {
    id: String(raw.player_id ?? ''),
    nickname: String(raw.nickname ?? ''),
    avatar: raw.avatar || null,
    country: raw.country ? String(raw.country).toLowerCase() : null,
    level: num(cs2?.skill_level),
    verified: !!raw.verified,
  };
}

export function matchUrl(matchId: string): string {
  return `https://www.faceit.com/en/cs2/room/${encodeURIComponent(matchId)}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
