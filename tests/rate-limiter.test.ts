import { describe, expect, it } from 'vitest';
import { HttpError, RateLimiter } from '@ext/background/rate-limiter';

const opts = { concurrency: 2, minIntervalMs: 0, maxRetries: 3, baseBackoffMs: 1, sleep: async () => undefined };

describe('RateLimiter', () => {
  it('never exceeds concurrency', async () => {
    const l = new RateLimiter(opts);
    let active = 0;
    let peak = 0;
    const job = () =>
      l.run(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return true;
      });
    await Promise.all(Array.from({ length: 10 }, job));
    expect(peak).toBe(2);
    expect(l.pending).toBe(0);
  });

  it('retries 429/5xx with Retry-After, then succeeds', async () => {
    const waits: number[] = [];
    const l = new RateLimiter({ ...opts, sleep: async (ms) => void waits.push(ms) });
    let n = 0;
    const v = await l.run(async () => {
      n++;
      if (n === 1) throw new HttpError(429, 'rl', 1500);
      if (n === 2) throw new HttpError(503, 'down');
      return 'ok';
    });
    expect(v).toBe('ok');
    expect(n).toBe(3);
    expect(waits).toContain(1500);
  });

  it('does not retry 4xx client errors', async () => {
    const l = new RateLimiter(opts);
    let n = 0;
    await expect(l.run(async () => { n++; throw new HttpError(404, 'nf'); })).rejects.toThrow('nf');
    expect(n).toBe(1);
  });

  it('gives up after maxRetries', async () => {
    const l = new RateLimiter(opts);
    let n = 0;
    await expect(l.run(async () => { n++; throw new HttpError(500, 'x'); })).rejects.toThrow();
    expect(n).toBe(4);
    expect(l.pending).toBe(0);
  });
});
