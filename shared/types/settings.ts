export type ApiMode = 'backend' | 'direct';

export interface AutoAcceptSettings {
  /** Never true unless the user explicitly turned it on. */
  enabled: boolean;
  /** Countdown before the click, 0–15 s. */
  delaySeconds: number;
  /** Desktop notification when a match is found. */
  notify: boolean;
  /** Short audible ping when a match is found. */
  sound: boolean;
  /** User has read and acknowledged the ToS warning. */
  acknowledged: boolean;
}

export interface Settings {
  apiMode: ApiMode;
  /** e.g. https://xyzcompany.supabase.co */
  backendUrl: string;
  /** Supabase anon (public) key — safe to ship, RLS protects the data. */
  backendAnonKey: string;
  /** Personal FACEIT client-side API key (direct mode only). Stored locally. */
  faceitApiKey: string;
  myNickname: string;
  myPlayerId: string;
  autoAccept: AutoAcceptSettings;
  injectProfilePanel: boolean;
  injectLobbyPanel: boolean;
  /** Max history pages (100 matches each) scanned per PvP request. */
  pvpPagesPerScan: number;
  /** Max shared matches for which detailed stats are fetched per request. */
  pvpStatsPerScan: number;
}

export interface FavoritePlayer {
  id: string;
  nickname: string;
  avatar: string | null;
  addedAt: number;
}

export interface RecentSearch {
  id: string;
  nickname: string;
  avatar: string | null;
  at: number;
}
