/**
 * Network transport to the FACEIT Data API v4.
 *
 * FACEIT's Data API always requires a Bearer API key (App Studio issues
 * server-side, i.e. secret, keys). Two routes, chosen automatically:
 *
 *  1. **Own key** — if the user pasted their own key in Settings, requests go
 *     straight to open.faceit.com with it. Stored only in storage.local.
 *  2. **SykosTracker proxy** (default for everyone else) — requests go to the
 *     publisher's stateless Cloudflare Worker (proxy/), which adds the
 *     publisher's key server-side. Its public URL is compiled in from
 *     sykos.config.json; the key itself never ships in the extension.
 *
 * Only an allow-listed set of read-only GET paths can be requested.
 */
import { FACEIT_API_BASE, RATE_LIMIT } from '@shared/constants';
import type { Settings } from '@shared/types/settings';
import { HttpError, RateLimiter } from './rate-limiter';
import { t } from '@shared/i18n';

export const ALLOWED_PATHS: RegExp[] = [
  /^\/players$/,
  /^\/players\/[\w-]+$/,
  /^\/players\/[\w-]+\/history$/,
  /^\/players\/[\w-]+\/stats\/cs2$/,
  /^\/players\/[\w-]+\/games\/cs2\/stats$/,
  /^\/matches\/[\w-]+$/,
  /^\/matches\/[\w-]+\/stats$/,
  /^\/search\/players$/,
];

export type Query = Record<string, string | number | undefined>;

export const limiter = new RateLimiter({ ...RATE_LIMIT });

export class ConfigError extends Error {
  code = 'NOT_CONFIGURED';
}

declare const __SYKOS_PROXY_URL__: string;
export const PROXY_URL: string = typeof __SYKOS_PROXY_URL__ === 'string' ? __SYKOS_PROXY_URL__ : '';

export type KeySource = 'user' | 'proxy' | 'none';

/** Own key wins; otherwise the built-in proxy; otherwise not configured. */
export function resolveKey(settings: Settings, proxyUrl = PROXY_URL): { key: string; source: KeySource } {
  const key = settings.faceitApiKey.trim();
  if (key) return { key, source: 'user' };
  if (proxyUrl) return { key: '', source: 'proxy' };
  return { key: '', source: 'none' };
}

/** Builds the request for either route. Exported for tests. */
export function buildRequest(settings: Settings, path: string, query: Query, proxyUrl = PROXY_URL): { url: string; headers: Record<string, string> } {
  const { key, source } = resolveKey(settings, proxyUrl);
  if (source === 'user') return { url: `${FACEIT_API_BASE}${path}${qs(query)}`, headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } };
  if (source === 'proxy') return { url: `${proxyUrl}/data/v4${path}${qs(query)}`, headers: { Accept: 'application/json' } };
  throw new ConfigError(t('err.noServer'));
}

function qs(q: Query): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

function retryAfter(res: Response): number | null {
  const h = res.headers.get('retry-after');
  if (!h) return null;
  const s = Number(h);
  return Number.isFinite(s) ? s * 1000 : null;
}

async function fail(res: Response): Promise<never> {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.errors?.[0]?.message ?? body?.error ?? body?.message ?? '';
  } catch {
    /* ignore */
  }
  const human: Record<number, string> = {
    401: t('err.401'),
    502: t('err.502'),
    403: t('err.403'),
    404: t('err.404'),
    429: t('err.429'),
  };
  throw new HttpError(res.status, human[res.status] ?? `HTTP ${res.status}${detail ? `: ${detail}` : ''}`, retryAfter(res));
}

export async function faceitGet<T = any>(settings: Settings, path: string, query: Query = {}): Promise<T> {
  if (!ALLOWED_PATHS.some((re) => re.test(path))) throw new Error(`Ruta no permitida: ${path}`);
  const { url, headers } = buildRequest(settings, path, query);

  return limiter.run(async () => {
    const res = await fetch(url, { headers, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) await fail(res);
    return (await res.json()) as T;
  });
}
