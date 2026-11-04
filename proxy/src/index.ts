/**
 * SykosTracker · FACEIT proxy (Cloudflare Worker)
 *
 * Lets users use SykosTracker with just their nickname: the publisher's FACEIT
 * API key lives here as an encrypted Worker secret and never ships in the
 * extension.
 *
 *   GET https://<worker>/data/v4/players?nickname=foo&game=cs2
 *     → GET https://open.faceit.com/data/v4/players?nickname=foo&game=cs2
 *       (with Authorization: Bearer FACEIT_API_KEY)
 *
 * It is NOT an open proxy:
 *  - only the read-only paths and query params SykosTracker uses are allowed;
 *  - per-IP rate limit (Workers Rate Limiting binding, optional);
 *  - optional ALLOWED_ORIGINS check;
 *  - responses are cached (Cache API + in-memory) to save FACEIT quota.
 * It stores no user data and keeps no logs of its own.
 */

export interface Env {
  /** Secret: `wrangler secret put FACEIT_API_KEY` */
  FACEIT_API_KEY: string;
  /** Optional, comma-separated. Supports trailing "*", e.g. "chrome-extension://abc,moz-extension://*" */
  ALLOWED_ORIGINS?: string;
  /** Optional Workers Rate Limiting binding (see wrangler.toml). */
  RATE_LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

const FACEIT = 'https://open.faceit.com/data/v4';

type Route = { re: RegExp; ttl: (body: any) => number };
export const ROUTES: Route[] = [
  { re: /^\/players$/, ttl: () => 600 },
  { re: /^\/players\/[\w-]{1,64}$/, ttl: () => 600 },
  { re: /^\/players\/[\w-]{1,64}\/history$/, ttl: () => 120 },
  { re: /^\/players\/[\w-]{1,64}\/stats\/cs2$/, ttl: () => 1800 },
  { re: /^\/players\/[\w-]{1,64}\/games\/cs2\/stats$/, ttl: () => 600 },
  { re: /^\/matches\/[\w-]{1,64}$/, ttl: (b) => (['FINISHED', 'CANCELLED'].includes(String(b?.status).toUpperCase()) ? 30 * 86400 : 20) },
  { re: /^\/matches\/[\w-]{1,64}\/stats$/, ttl: () => 30 * 86400 },
  { re: /^\/search\/players$/, ttl: () => 3600 },
];
export const QUERY_KEYS = new Set(['nickname', 'game', 'offset', 'limit', 'from', 'to']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'accept',
  'Access-Control-Max-Age': '86400',
};

function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...extra } });
}

export function originAllowed(origin: string | null, list: string | undefined): boolean {
  const allowed = (list ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.length || !origin) return true; // not configured, or non-browser request without Origin
  return allowed.some((o) => (o.endsWith('*') ? origin.startsWith(o.slice(0, -1)) : o === origin));
}

/** Validates and normalises the request. Returns the upstream path+query or an error response. */
export function normalise(url: URL): { route: Route; key: string } | Response {
  if (!url.pathname.startsWith('/data/v4/')) return json(404, { error: 'not found' });
  const path = url.pathname.slice('/data/v4'.length);
  const route = ROUTES.find((r) => r.re.test(path));
  if (!route) return json(400, { error: 'path not allowed' });
  const params = new URLSearchParams();
  for (const [k, v] of [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!QUERY_KEYS.has(k)) return json(400, { error: `query param not allowed: ${k}` });
    if (v.length > 64) return json(400, { error: `query param too long: ${k}` });
    if (v !== '') params.set(k, v);
  }
  const qs = params.toString();
  return { route, key: `${path}${qs ? `?${qs}` : ''}` };
}

// Best-effort per-isolate memory cache. The Cache API below is the main one
// (note: Cloudflare's Cache API only stores on custom domains, not *.workers.dev).
const memory = new Map<string, { body: string; status: number; expires: number }>();
const MEMORY_MAX = 500;

function remember(key: string, body: string, status: number, ttl: number) {
  memory.delete(key);
  memory.set(key, { body, status, expires: Date.now() + ttl * 1000 });
  if (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value!);
}

export default {
  async fetch(req: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/health') return json(200, { ok: true, service: 'sykostracker-proxy' });
    if (req.method !== 'GET') return json(405, { error: 'method not allowed' });
    if (!originAllowed(req.headers.get('origin'), env.ALLOWED_ORIGINS)) return json(403, { error: 'origin not allowed' });
    if (!env.FACEIT_API_KEY) return json(500, { error: 'FACEIT_API_KEY secret is not set' });

    const n = normalise(url);
    if (n instanceof Response) return n;

    if (env.RATE_LIMITER) {
      const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return json(429, { error: 'rate limited' }, { 'Retry-After': '30' });
    }

    const m = memory.get(n.key);
    if (m && m.expires > Date.now()) return new Response(m.body, { status: m.status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'MEM' } });

    const cacheKey = new Request(`https://sykos-cache.internal${n.key.startsWith('/') ? '' : '/'}${n.key}`);
    const cache = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
    const hit = cache ? await cache.match(cacheKey) : undefined;
    if (hit) {
      const r = new Response(hit.body, hit);
      r.headers.set('X-Cache', 'HIT');
      return r;
    }

    let upstream: Response;
    try {
      upstream = await fetch(`${FACEIT}${n.key}`, { headers: { Authorization: `Bearer ${env.FACEIT_API_KEY}`, Accept: 'application/json' } });
    } catch {
      return json(502, { error: 'FACEIT unreachable' });
    }
    const text = await upstream.text();

    if (upstream.status === 429) return json(429, { error: 'FACEIT rate limit' }, { 'Retry-After': upstream.headers.get('retry-after') ?? '30' });
    // Never leak FACEIT auth problems as "your key is wrong" to users: it is the publisher's key.
    if (upstream.status === 401 || upstream.status === 403) return json(502, { error: 'proxy key rejected by FACEIT' });

    if (upstream.status === 200 || upstream.status === 404) {
      let body: unknown = null;
      try {
        body = JSON.parse(text);
      } catch {
        /* non-JSON: do not cache */
      }
      if (body !== null) {
        const ttl = upstream.status === 404 ? 300 : n.route.ttl(body);
        remember(n.key, text, upstream.status, ttl);
        const res = new Response(text, {
          status: upstream.status,
          headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${ttl}`, 'X-Cache': 'MISS' },
        });
        if (cache) ctx.waitUntil(cache.put(cacheKey, res.clone()));
        return res;
      }
    }
    return new Response(text, { status: upstream.status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
  },
};
