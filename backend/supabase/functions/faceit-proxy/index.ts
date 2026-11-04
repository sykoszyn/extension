/**
 * SykosTracker · faceit-proxy (Supabase Edge Function, Deno)
 *
 * Read-only proxy to the FACEIT Data API v4 that keeps the FACEIT API key
 * server-side. The extension never sees the key.
 *
 *   POST /functions/v1/faceit-proxy   { "path": "/players", "query": { "nickname": "x" } }
 *
 * Protections:
 *  - Allow-list of GET paths and query parameters (no arbitrary proxying).
 *  - Optional origin allow-list (ALLOWED_ORIGINS = chrome-extension://<id>,moz-extension://*).
 *  - Per-install + per-IP rate limit (Postgres, see migrations).
 *  - Shared response cache in Postgres to save FACEIT quota.
 *
 * Secrets (supabase secrets set …): FACEIT_API_KEY, optional ALLOWED_ORIGINS,
 * optional RATE_LIMIT_PER_MINUTE (default 120).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FACEIT = 'https://open.faceit.com/data/v4';
const API_KEY = Deno.env.get('FACEIT_API_KEY') ?? '';
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const LIMIT = Number(Deno.env.get('RATE_LIMIT_PER_MINUTE') ?? 120);

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const ROUTES: { re: RegExp; ttl: (body: any) => number }[] = [
  { re: /^\/players$/, ttl: () => 600 },
  { re: /^\/players\/[\w-]{1,64}$/, ttl: () => 600 },
  { re: /^\/players\/[\w-]{1,64}\/history$/, ttl: () => 120 },
  { re: /^\/players\/[\w-]{1,64}\/stats\/cs2$/, ttl: () => 1800 },
  { re: /^\/players\/[\w-]{1,64}\/games\/cs2\/stats$/, ttl: () => 600 },
  { re: /^\/matches\/[\w-]{1,64}$/, ttl: (b) => (['FINISHED', 'CANCELLED'].includes(String(b?.status).toUpperCase()) ? 30 * 86400 : 20) },
  { re: /^\/matches\/[\w-]{1,64}\/stats$/, ttl: () => 30 * 86400 },
  { re: /^\/search\/players$/, ttl: () => 3600 },
];
const QUERY_KEYS = new Set(['nickname', 'game', 'game_player_id', 'offset', 'limit', 'from', 'to']);

/** Exact match, or prefix match for entries ending in "*" (e.g. "moz-extension://*"). */
const originAllowed = (origin: string) => ORIGINS.some((o) => (o.endsWith('*') ? origin.startsWith(o.slice(0, -1)) : o === origin));

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (ORIGINS.length === 0 || originAllowed(origin)) ? origin : '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-sykos-install',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

function json(status: number, body: unknown, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const h = cors(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' }, h);
  if (ORIGINS.length && (!origin || !originAllowed(origin))) return json(403, { error: 'origin not allowed' }, h);
  if (!API_KEY) return json(500, { error: 'FACEIT_API_KEY secret is not set' }, h);

  let path: string;
  let query: Record<string, unknown>;
  try {
    const body = await req.json();
    path = String(body?.path ?? '');
    query = typeof body?.query === 'object' && body.query ? body.query : {};
  } catch {
    return json(400, { error: 'invalid JSON' }, h);
  }

  const route = ROUTES.find((r) => r.re.test(path));
  if (!route) return json(400, { error: 'path not allowed' }, h);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query).sort(([a], [b]) => a.localeCompare(b))) {
    if (v === undefined || v === null || v === '') continue;
    if (!QUERY_KEYS.has(k)) return json(400, { error: `query param not allowed: ${k}` }, h);
    const s = String(v);
    if (s.length > 64) return json(400, { error: `query param too long: ${k}` }, h);
    params.set(k, s);
  }

  // Rate limit by anonymous install id + hashed IP (IP is never stored in clear).
  const install = (req.headers.get('x-sykos-install') ?? '').slice(0, 64) || 'anon';
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const subject = await sha256(`${install}|${ip}`);
  const { data: allowed, error: rlErr } = await db.rpc('sykos_hit_rate_limit', { p_subject: subject, p_limit: LIMIT });
  if (rlErr) console.error('rate limit error', rlErr.message);
  if (allowed === false) return json(429, { error: 'rate limited' }, { ...h, 'Retry-After': '30' });

  const qs = params.toString();
  const key = `${path}?${qs}`;

  const { data: hit } = await db.from('api_cache').select('body, status').eq('key', key).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (hit) return json(hit.status, hit.body, { ...h, 'X-Cache': 'HIT' });

  const res = await fetch(`${FACEIT}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text.slice(0, 200) };
  }

  if (res.status === 429) return json(429, { error: 'FACEIT rate limit' }, { ...h, 'Retry-After': res.headers.get('retry-after') ?? '30' });

  // Cache successes and 404s (unknown nicknames) — never cache 5xx.
  if (res.status === 200 || res.status === 404) {
    const ttl = res.status === 404 ? 300 : route.ttl(body);
    await db
      .from('api_cache')
      .upsert({ key, body, status: res.status, expires_at: new Date(Date.now() + ttl * 1000).toISOString() })
      .then(({ error }) => error && console.error('cache write', error.message));
  }
  return json(res.status, body, { ...h, 'X-Cache': 'MISS' });
});
