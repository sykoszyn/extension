/**
 * Network transport to the FACEIT Data API v4.
 *
 * Two modes, selected in Settings:
 *  - backend (recommended): POST to the Supabase Edge Function `faceit-proxy`,
 *    which holds the FACEIT server-side API key as a secret. The extension
 *    only ships the public Supabase anon key.
 *  - direct: the user pastes their OWN FACEIT client-side key; requests go
 *    straight to open.faceit.com. The key is stored only in this browser.
 *
 * In both modes only an allow-listed set of read-only GET paths is used.
 */
import { FACEIT_API_BASE, RATE_LIMIT } from '@shared/constants';
import type { Settings } from '@shared/types/settings';
import { HttpError, RateLimiter } from './rate-limiter';
import { ext } from '@ext/compat/browser';

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
    401: 'Clave de API rechazada por FACEIT (401).',
    403: 'Acceso denegado (403).',
    404: 'No encontrado en FACEIT (404).',
    429: 'Límite de peticiones alcanzado; reintentando…',
  };
  throw new HttpError(res.status, human[res.status] ?? `Error HTTP ${res.status}${detail ? `: ${detail}` : ''}`, retryAfter(res));
}

export async function faceitGet<T = any>(settings: Settings, path: string, query: Query = {}): Promise<T> {
  if (!ALLOWED_PATHS.some((re) => re.test(path))) throw new Error(`Ruta no permitida: ${path}`);

  return limiter.run(async () => {
    if (settings.apiMode === 'direct') {
      if (!settings.faceitApiKey) throw new ConfigError('Falta tu clave de FACEIT API (Ajustes → Conexión).');
      const res = await fetch(`${FACEIT_API_BASE}${path}${qs(query)}`, {
        headers: { Authorization: `Bearer ${settings.faceitApiKey}`, Accept: 'application/json' },
      });
      if (!res.ok) await fail(res);
      return (await res.json()) as T;
    }
    if (!settings.backendUrl || !settings.backendAnonKey)
      throw new ConfigError('Configura la URL y la anon key del backend de Supabase (Ajustes → Conexión).');
    const base = settings.backendUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/functions/v1/faceit-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: settings.backendAnonKey,
        Authorization: `Bearer ${settings.backendAnonKey}`,
        'x-sykos-install': await installId(),
      },
      body: JSON.stringify({ path, query }),
    });
    if (!res.ok) await fail(res);
    return (await res.json()) as T;
  });
}

/** Random, anonymous per-install id used only for backend rate limiting. */
let cachedInstall: string | null = null;
async function installId(): Promise<string> {
  if (cachedInstall) return cachedInstall;
  const got = await ext.storage.local.get('sykos.install');
  cachedInstall = (got['sykos.install'] as string) || crypto.randomUUID();
  if (!got['sykos.install']) await ext.storage.local.set({ 'sykos.install': cachedInstall });
  return cachedInstall;
}
