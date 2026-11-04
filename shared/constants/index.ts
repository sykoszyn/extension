import type { Settings } from '../types/settings';

export const APP_NAME = 'SykosTracker';
export const GAME_ID = 'cs2';
export const FACEIT_API_BASE = 'https://open.faceit.com/data/v4';
export const FACEIT_WEB = 'https://www.faceit.com';

/**
 * CS2 matches on FACEIT started in 2023. The history endpoint defaults `from`
 * to roughly one month ago when omitted, so we always pass an explicit lower
 * bound to reach the whole history.
 */
export const HISTORY_EPOCH_SECONDS = 1672531200; // 2023-01-01T00:00:00Z
export const HISTORY_PAGE_SIZE = 100;
export const MATCH_STATS_PAGE_SIZE = 100;

export const DEFAULT_SETTINGS: Settings = {
  faceitApiKey: '',
  myNickname: '',
  myPlayerId: '',
  autoAccept: { enabled: false, delaySeconds: 3, notify: true, sound: true, acknowledged: false },
  injectProfilePanel: true,
  injectLobbyPanel: true,
  pvpPagesPerScan: 10,
  pvpStatsPerScan: 40,
};

/** Cache TTLs in ms. Finished matches never change, so they are kept long. */
export const TTL = {
  profile: 10 * 60_000,
  lifetime: 30 * 60_000,
  recentStats: 10 * 60_000,
  historyPage: 5 * 60_000,
  matchLive: 20_000,
  matchFinished: 30 * 24 * 3600_000,
  search: 60 * 60_000,
} as const;

export const RATE_LIMIT = {
  /** concurrent in-flight requests */
  concurrency: 4,
  /** minimum spacing between request starts */
  minIntervalMs: 110,
  maxRetries: 4,
  baseBackoffMs: 800,
} as const;

/** Active Duty + common FACEIT CS2 maps, used for labels/colours only. */
export const MAP_META: Record<string, { label: string; short: string; hue: number }> = {
  de_mirage: { label: 'Mirage', short: 'MIR', hue: 38 },
  de_inferno: { label: 'Inferno', short: 'INF', hue: 12 },
  de_nuke: { label: 'Nuke', short: 'NUK', hue: 200 },
  de_ancient: { label: 'Ancient', short: 'ANC', hue: 145 },
  de_anubis: { label: 'Anubis', short: 'ANU', hue: 48 },
  de_dust2: { label: 'Dust II', short: 'D2', hue: 30 },
  de_train: { label: 'Train', short: 'TRN', hue: 220 },
  de_vertigo: { label: 'Vertigo', short: 'VRT', hue: 190 },
  de_overpass: { label: 'Overpass', short: 'OVP', hue: 160 },
  de_cache: { label: 'Cache', short: 'CCH', hue: 90 },
};

export const RESULT_FILTERS = [
  { key: '7d', label: '7 días', ms: 7 * 86400_000 },
  { key: '30d', label: '30 días', ms: 30 * 86400_000 },
  { key: '3m', label: '3 meses', ms: 91 * 86400_000 },
  { key: '6m', label: '6 meses', ms: 182 * 86400_000 },
  { key: 'all', label: 'Todo', ms: Infinity },
] as const;

export type PeriodKey = (typeof RESULT_FILTERS)[number]['key'];
