import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { originAllowed } from '../proxy/src/index';

const ctx = { waitUntil: () => undefined };
const env = (over: Record<string, unknown> = {}) => ({ FACEIT_API_KEY: 'publisher-secret', ...over }) as any;
const get = (path: string, headers: Record<string, string> = {}) => new Request(`https://proxy.test${path}`, { headers });

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status = 200, body: unknown = { player_id: 'p1', nickname: 'Sykos' }) {
  const f = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', f);
  return f;
}

describe('Cloudflare proxy', () => {
  it('health check', async () => {
    const r = await worker.fetch(get('/health'), env(), ctx);
    expect(await r.json()).toMatchObject({ ok: true });
  });

  it('forwards allowed GETs to FACEIT with the secret key (never echoed back)', async () => {
    const f = stubFetch();
    const r = await worker.fetch(get('/data/v4/players?nickname=Sykos&game=cs2'), env(), ctx);
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://open.faceit.com/data/v4/players?game=cs2&nickname=Sykos');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer publisher-secret');
    const text = await r.text();
    expect(text).not.toContain('publisher-secret');
    expect([...r.headers.values()].join()).not.toContain('publisher-secret');
  });

  it('serves repeated requests from cache', async () => {
    const f = stubFetch();
    await worker.fetch(get('/data/v4/players/abc-123'), env(), ctx);
    const again = await worker.fetch(get('/data/v4/players/abc-123'), env(), ctx);
    expect(f).toHaveBeenCalledTimes(1);
    expect(again.headers.get('X-Cache')).toBe('MEM');
  });

  it('is not an open proxy', async () => {
    const f = stubFetch();
    expect((await worker.fetch(get('/data/v4/championships'), env(), ctx)).status).toBe(400);
    expect((await worker.fetch(get('/data/v4/players?nickname=a&evil=1'), env(), ctx)).status).toBe(400);
    expect((await worker.fetch(get('/https://example.com'), env(), ctx)).status).toBe(404);
    expect((await worker.fetch(new Request('https://proxy.test/data/v4/players', { method: 'POST' }), env(), ctx)).status).toBe(405);
    expect(f).not.toHaveBeenCalled();
  });

  it('rate limits per IP when the binding exists', async () => {
    stubFetch();
    const limiter = { limit: vi.fn(async () => ({ success: false })) };
    const r = await worker.fetch(get('/data/v4/players/x1', { 'cf-connecting-ip': '1.2.3.4' }), env({ RATE_LIMITER: limiter }), ctx);
    expect(r.status).toBe(429);
    expect(limiter.limit).toHaveBeenCalledWith({ key: '1.2.3.4' });
  });

  it('maps a rejected publisher key to 502 and passes 429 through', async () => {
    stubFetch(401, { errors: [] });
    expect((await worker.fetch(get('/data/v4/players/k401'), env(), ctx)).status).toBe(502);
    stubFetch(429, {});
    expect((await worker.fetch(get('/data/v4/players/k429'), env(), ctx)).status).toBe(429);
  });

  it('returns 502 (not a crash) when FACEIT is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    expect((await worker.fetch(get('/data/v4/players/down'), env(), ctx)).status).toBe(502);
  });

  it('fails clearly without the secret', async () => {
    stubFetch();
    expect((await worker.fetch(get('/data/v4/players/x'), env({ FACEIT_API_KEY: '' }), ctx)).status).toBe(500);
  });

  it('origin allow-list', () => {
    expect(originAllowed('chrome-extension://abc', undefined)).toBe(true);
    expect(originAllowed('chrome-extension://abc', 'chrome-extension://abc,moz-extension://*')).toBe(true);
    expect(originAllowed('moz-extension://123-uuid', 'chrome-extension://abc,moz-extension://*')).toBe(true);
    expect(originAllowed('https://evil.com', 'chrome-extension://abc')).toBe(false);
  });
});
