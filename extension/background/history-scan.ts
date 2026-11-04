/**
 * Progressive, resumable scan of a player's full CS2 match history.
 *
 * The history endpoint returns at most 100 matches per call, so a player
 * with 3 000 matches needs 30 requests. Instead of doing that eagerly we:
 *  1. keep everything already discovered in IndexedDB (`history` store);
 *  2. on each request fetch only NEW matches (newer than what we have);
 *  3. walk backwards in time with a `to` cursor (avoids large offsets),
 *     at most `maxPages` per request, until a short page proves we reached
 *     the beginning → `complete = true`.
 * The UI always shows `coverage` so partial results are never hidden.
 */
import { HISTORY_PAGE_SIZE } from '@shared/constants';
import type { HistoryCoverage } from '@shared/types/analytics';
import type { HistoryMatch } from '@shared/types/faceit';
import { mergeHistory } from '@shared/utils/analytics';

export interface StoredHistory {
  matches: HistoryMatch[];
  complete: boolean;
  updatedAt: number | null;
}

export type FetchPage = (opts: { offset: number; limit: number; from?: number; to?: number }) => Promise<HistoryMatch[]>;

export const EMPTY_HISTORY: StoredHistory = { matches: [], complete: false, updatedAt: null };

export function coverageOf(h: StoredHistory): HistoryCoverage {
  return {
    scanned: h.matches.length,
    newest: h.matches[0]?.startedAt ?? null,
    oldest: h.matches[h.matches.length - 1]?.startedAt ?? null,
    complete: h.complete,
    updatedAt: h.updatedAt,
  };
}

const sec = (ms: number) => Math.floor(ms / 1000);

export async function scanHistory(
  stored: StoredHistory,
  fetchPage: FetchPage,
  opts: { maxPages: number; older: boolean; refreshNewer: boolean; now?: number },
): Promise<StoredHistory> {
  const now = opts.now ?? Date.now();
  let matches = stored.matches;
  let complete = stored.complete;
  let pages = 0;
  const known = () => new Set(matches.map((m) => m.matchId));

  // 1) Newer matches since the newest one we know.
  if (matches.length && opts.refreshNewer) {
    const from = sec(matches[0].startedAt);
    for (let offset = 0; pages < opts.maxPages; offset += HISTORY_PAGE_SIZE) {
      const page = await fetchPage({ offset, limit: HISTORY_PAGE_SIZE, from });
      pages++;
      const ids = known();
      const fresh = page.filter((m) => !ids.has(m.matchId));
      matches = mergeHistory(matches, fresh);
      if (page.length < HISTORY_PAGE_SIZE || fresh.length < page.length) break;
    }
  }

  // 2) First scan, or walking backwards.
  if (!complete && (opts.older || !matches.length)) {
    let offset = 0;
    let to: number | undefined = matches.length ? sec(matches[matches.length - 1].startedAt) : undefined;
    while (pages < opts.maxPages) {
      const page = await fetchPage({ offset, limit: HISTORY_PAGE_SIZE, to });
      pages++;
      const ids = known();
      const fresh = page.filter((m) => !ids.has(m.matchId));
      matches = mergeHistory(matches, fresh);
      if (page.length < HISTORY_PAGE_SIZE) {
        complete = true;
        break;
      }
      if (fresh.length === 0) {
        // Whole page shares the cursor second(s) — step forward inside the window.
        offset += HISTORY_PAGE_SIZE;
      } else {
        offset = 0;
        to = sec(matches[matches.length - 1].startedAt);
      }
    }
  }

  return { matches, complete, updatedAt: now };
}
