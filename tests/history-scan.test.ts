import { describe, expect, it, vi } from 'vitest';
import { coverageOf, EMPTY_HISTORY, scanHistory, type FetchPage } from '@ext/background/history-scan';
import { parseHistoryItem } from '@shared/utils/parse';
import { HISTORY_EPOCH_SECONDS } from '@shared/constants';
import { handle, ME, MATCHES } from './fixtures/mock-faceit.mjs';

const fetchPage: FetchPage = async (o) =>
  handle(`/players/${ME.id}/history`, { ...o, from: o.from ?? HISTORY_EPOCH_SECONDS }).body.items.map((i: any) => parseHistoryItem(i)!);

describe('progressive history scan', () => {
  it('scans in bounded chunks and reports partial coverage', async () => {
    const spy = vi.fn(fetchPage);
    const first = await scanHistory(EMPTY_HISTORY, spy, { maxPages: 1, older: false, refreshNewer: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(first.matches).toHaveLength(100);
    expect(first.complete).toBe(false);
    expect(coverageOf(first).scanned).toBe(100);

    const second = await scanHistory(first, spy, { maxPages: 1, older: true, refreshNewer: false });
    expect(second.matches.length).toBeGreaterThan(190);
    expect(second.complete).toBe(false);

    const full = await scanHistory(second, spy, { maxPages: 10, older: true, refreshNewer: false });
    expect(full.complete).toBe(true);
    expect(full.matches).toHaveLength(MATCHES.length);
    expect(new Set(full.matches.map((m) => m.matchId)).size).toBe(MATCHES.length);
  });

  it('a complete history only fetches newer matches', async () => {
    const full = await scanHistory(EMPTY_HISTORY, fetchPage, { maxPages: 10, older: true, refreshNewer: false });
    const spy = vi.fn(fetchPage);
    const again = await scanHistory(full, spy, { maxPages: 10, older: true, refreshNewer: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].from).toBe(Math.floor(full.matches[0].startedAt / 1000));
    expect(again.matches).toHaveLength(full.matches.length);
  });
});
