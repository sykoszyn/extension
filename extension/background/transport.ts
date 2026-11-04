/**
 * Network transport to the FACEIT Data API v4 — the ONLY external host the
 * extension talks to. There is no SykosTracker server.
 *
 * Authentication: FACEIT's Data API always requires a Bearer API key, and
 * FACEIT App Studio currently issues **server-side** keys. The key is the
 * user's OWN, pasted in Settings, stored only in this browser's
 * storage.local and sent only to open.faceit.com from the background worker.
 * No key is ever compiled into the distributed extension. See docs/04.
 *
 * Only an allow-listed set of read-only GET paths can be requested.
 */
import { FACEIT_API_BASE, RATE_LIMIT } from '@shared/constants';
import type { Settings } from '@shared/types/settings';
import { HttpError, RateLimiter } from './rate-limiter';

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

/** The user's own key from local settings, if any. */
export function resolveKey(settings: Settings): { key: string; source: 'user' | 'none' } {
  const key = settings.faceitApiKey.trim();
  return key ? { key, source: 'user' } : { key: '', source: 'none' };
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
    401: 'FACEIT ha rechazado la clave de API (401). Revisa que la hayas copiado entera y que no esté revocada.',
    403: 'FACEIT ha denegado el acceso (403).',
    404: 'No encontrado en FACEIT (404).',
    429: 'Límite de peticiones de FACEIT alcanzado; reintentando…',
  };
  throw new HttpError(res.status, human[res.status] ?? `Error HTTP ${res.status}${detail ? `: ${detail}` : ''}`, retryAfter(res));
}

export async function faceitGet<T = any>(settings: Settings, path: string, query: Query = {}): Promise<T> {
  if (!ALLOWED_PATHS.some((re) => re.test(path))) throw new Error(`Ruta no permitida: ${path}`);
  const { key } = resolveKey(settings);
  if (!key) throw new ConfigError('Añade tu API key de FACEIT en Configuración → Conexión con FACEIT.');

  return limiter.run(async () => {
    const res = await fetch(`${FACEIT_API_BASE}${path}${qs(query)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) await fail(res);
    return (await res.json()) as T;
  });
}
