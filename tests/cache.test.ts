import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { cached, peekCached } from '@ext/background/db';

describe('read-through cache', () => {
  it('dedupes concurrent loads and honours TTL', async () => {
    let t = 1000;
    const now = () => t;
    const load = vi.fn(async () => ({ v: Math.random() }));
    const [a, b] = await Promise.all([cached('k1', { ttl: 100 }, load, now), cached('k1', { ttl: 100 }, load, now)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    t = 1050;
    expect(await cached('k1', { ttl: 100 }, load, now)).toBe(a);
    t = 1200;
    await cached('k1', { ttl: 100 }, load, now);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('force bypasses cache; ttlFor sets value-based TTL', async () => {
    const load = vi.fn(async () => ({ status: 'FINISHED' }));
    await cached('k2', { ttl: 1, ttlFor: () => 1e9 }, load);
    expect(await peekCached('k2')).toEqual({ status: 'FINISHED' });
    await cached('k2', { ttl: 1, force: true }, load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
