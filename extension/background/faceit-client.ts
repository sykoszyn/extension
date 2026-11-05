/**
 * FACEIT Data API v4 endpoints used by SykosTracker (all read-only GET):
 *
 *   GET /players?nickname=&game=cs2           resolve nickname → player
 *   GET /players/{id}                         profile, ELO, level
 *   GET /players/{id}/stats/cs2               lifetime + per-map segments
 *   GET /players/{id}/games/cs2/stats         per-match stat lines (limit ≤ 100)
 *   GET /players/{id}/history?game=cs2        match list with rosters (limit ≤ 100)
 *   GET /matches/{id}                         match room: teams, veto, status
 *   GET /matches/{id}/stats                   scoreboard of a finished match
 *   GET /search/players?nickname=&game=cs2    fuzzy player search
 *
 * Every call goes through the read-through cache (`cached`) and the global
 * rate limiter (inside `faceitGet`).
 */
import { GAME_ID, HISTORY_EPOCH_SECONDS, MATCH_STATS_PAGE_SIZE, TTL } from '@shared/constants';
import type { EloSnapshot, HistoryMatch, LifetimeStats, MatchDetails, MatchStatLine, MatchStats, PlayerProfile, SearchHit } from '@shared/types/faceit';
import type { Settings } from '@shared/types/settings';
import {
  parseHistoryItem,
  parseLifetime,
  parseMatch,
  parseMatchStatLine,
  parseMatchStats,
  parsePlayer,
  parseSearchHit,
} from '@shared/utils/parse';
import { MATCH_ID_RE } from '@shared/utils/faceit-url';
import { cached, idb } from './db';
import { faceitGet } from './transport';
import { HttpError } from './rate-limiter';
import { t } from '@shared/i18n';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINISHED = new Set(['FINISHED', 'CANCELLED']);

export class FaceitClient {
  constructor(private settings: () => Promise<Settings>) {}

  private async get<T>(path: string, query?: Record<string, string | number | undefined>) {
    return faceitGet<T>(await this.settings(), path, query);
  }

  async resolvePlayer(query: string, force = false): Promise<PlayerProfile> {
    const q = query.trim();
    const isId = UUID_RE.test(q);
    const key = isId ? `player:${q}` : `player:nick:${q.toLowerCase()}`;
    const profile = await cached(key, { ttl: TTL.profile, force }, async () =>
      parsePlayer(isId ? await this.get(`/players/${q}`) : await this.get('/players', { nickname: q, game: GAME_ID })),
    );
    void this.recordElo(profile);
    return profile;
  }

  async search(query: string): Promise<SearchHit[]> {
    const q = query.trim();
    return cached(`search:${q.toLowerCase()}`, { ttl: TTL.search }, async () => {
      const raw = await this.get<{ items?: unknown[] }>('/search/players', { nickname: q, game: GAME_ID, limit: 10 });
      return (raw.items ?? []).map((i) => parseSearchHit(i as any)).filter((h) => h.id);
    });
  }

  lifetime(id: string, force = false): Promise<LifetimeStats> {
    return cached(`lifetime:${id}`, { ttl: TTL.lifetime, force }, async () => {
      try {
        return parseLifetime(await this.get(`/players/${id}/stats/${GAME_ID}`));
      } catch (e) {
        // Players with no CS2 matches get a 404 here — that is "no data", not an error.
        if (e instanceof HttpError && e.status === 404) return parseLifetime({ player_id: id });
        throw e;
      }
    });
  }

  /** Last `limit` (≤100) match stat lines, most recent first. */
  recentStats(id: string, limit = 20, force = false): Promise<MatchStatLine[]> {
    const lim = Math.max(1, Math.min(MATCH_STATS_PAGE_SIZE, limit));
    return cached(`recent:${id}:${lim}`, { ttl: TTL.recentStats, force }, async () => {
      try {
        const raw = await this.get<{ items?: unknown[] }>(`/players/${id}/games/${GAME_ID}/stats`, { offset: 0, limit: lim });
        return (raw.items ?? [])
          .map((i) => parseMatchStatLine(i as any))
          .filter((l): l is MatchStatLine => !!l)
          .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) return [];
        throw e;
      }
    });
  }

  /** One page of match history. `to`/`from` are unix seconds. */
  async historyPage(id: string, opts: { offset?: number; limit?: number; from?: number; to?: number }): Promise<HistoryMatch[]> {
    const q = {
      game: GAME_ID,
      offset: opts.offset ?? 0,
      limit: Math.min(100, opts.limit ?? 100),
      from: opts.from ?? HISTORY_EPOCH_SECONDS,
      to: opts.to,
    };
    return cached(`history:${id}:${q.offset}:${q.limit}:${q.from}:${q.to ?? ''}`, { ttl: TTL.historyPage }, async () => {
      const raw = await this.get<{ items?: unknown[] }>(`/players/${id}/history`, q);
      return (raw.items ?? []).map((i) => parseHistoryItem(i as any)).filter((m): m is HistoryMatch => !!m);
    });
  }

  match(id: string, force = false): Promise<MatchDetails> {
    if (!MATCH_ID_RE.test(id)) throw new Error(t('err.badMatchId'));
    return cached(
      `match:${id}`,
      { ttl: TTL.matchLive, force, ttlFor: (m: MatchDetails) => (FINISHED.has(m.status) ? TTL.matchFinished : TTL.matchLive) },
      async () => parseMatch(await this.get(`/matches/${id}`)),
    );
  }

  /** Scoreboard; `null` when the match has no stats (not played / cancelled). */
  matchStats(id: string): Promise<MatchStats | null> {
    return cached(
      `mstats:${id}`,
      { ttl: TTL.matchFinished, ttlFor: (v) => (v ? TTL.matchFinished : TTL.matchLive * 15) },
      async () => {
        try {
          return parseMatchStats(await this.get(`/matches/${id}/stats`), id);
        } catch (e) {
          if (e instanceof HttpError && e.status === 404) return null;
          throw e;
        }
      },
    );
  }

  // ───────── ELO evolution ─────────
  // The Data API exposes only the CURRENT ELO, not per-match ELO. SykosTracker
  // therefore records the ELO it observes over time. The chart is labelled
  // "ELO observado por SykosTracker" and starts the first time you looked.

  async recordElo(p: PlayerProfile) {
    if (p.elo === null || !p.id) return;
    const list = (await idb.get<EloSnapshot[]>('elo', p.id).catch(() => undefined)) ?? [];
    const last = list[list.length - 1];
    if (last && last.elo === p.elo && p.fetchedAt - last.t < 6 * 3600_000) return;
    if (last && p.fetchedAt <= last.t) return;
    list.push({ t: p.fetchedAt, elo: p.elo });
    await idb.put('elo', p.id, list.slice(-500)).catch(() => undefined);
  }

  async eloHistory(id: string): Promise<EloSnapshot[]> {
    return (await idb.get<EloSnapshot[]>('elo', id).catch(() => undefined)) ?? [];
  }
}
