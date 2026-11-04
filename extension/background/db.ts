/**
 * Tiny IndexedDB wrapper (available in both Chromium service workers and
 * Firefox event pages). Three object stores:
 *   cache   — API response cache   { key, value, expires }
 *   history — discovered match history per player (PvP progressive scan)
 *   elo     — ELO snapshots observed by SykosTracker per player
 */

const DB_NAME = 'sykostracker';
const DB_VERSION = 1;
export type StoreName = 'cache' | 'history' | 'elo';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ['cache', 'history', 'elo'] as StoreName[]) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, key: string) => tx<T | undefined>(store, 'readonly', (s) => s.get(key)),
  put: (store: StoreName, key: string, value: unknown) => tx(store, 'readwrite', (s) => s.put(value, key)).then(() => undefined),
  del: (store: StoreName, key: string) => tx(store, 'readwrite', (s) => s.delete(key)).then(() => undefined),
  clear: (store: StoreName) => tx(store, 'readwrite', (s) => s.clear()).then(() => undefined),
  keys: (store: StoreName) => tx<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()),
};

interface CacheEntry<T> {
  value: T;
  expires: number;
}

/** Memory front cache — survives as long as the worker lives. */
const memory = new Map<string, CacheEntry<unknown>>();
const MEMORY_MAX = 400;
const inflight = new Map<string, Promise<unknown>>();

export interface CacheOptions {
  ttl: number;
  force?: boolean;
  /** Decide the TTL from the value (e.g. finished matches live longer). */
  ttlFor?: (value: any) => number;
}

/**
 * Read-through cache with in-flight de-duplication: N concurrent requests for
 * the same key cause exactly one network call.
 */
export async function cached<T>(key: string, opts: CacheOptions, load: () => Promise<T>, now = Date.now): Promise<T> {
  if (!opts.force) {
    const m = memory.get(key) as CacheEntry<T> | undefined;
    if (m && m.expires > now()) return m.value;
    const d = await idb.get<CacheEntry<T>>('cache', key).catch(() => undefined);
    if (d && d.expires > now()) {
      remember(key, d);
      return d.value;
    }
  }
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = (async () => {
    try {
      const value = await load();
      const entry = { value, expires: now() + (opts.ttlFor ? opts.ttlFor(value) : opts.ttl) };
      remember(key, entry);
      await idb.put('cache', key, entry).catch(() => undefined);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function remember(key: string, entry: CacheEntry<unknown>) {
  memory.delete(key);
  memory.set(key, entry);
  if (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value!);
}

export async function clearCache() {
  memory.clear();
  await idb.clear('cache');
}

/** Drops expired cache rows. Called from a periodic alarm. */
export async function pruneCache(now = Date.now()) {
  const keys = await idb.keys('cache');
  for (const k of keys) {
    const e = await idb.get<CacheEntry<unknown>>('cache', String(k));
    if (!e || e.expires <= now) await idb.del('cache', String(k));
  }
}

/** Returns a cached value without loading it (undefined on miss/expired). */
export async function peekCached<T>(key: string, now = Date.now()): Promise<T | undefined> {
  const m = memory.get(key) as CacheEntry<T> | undefined;
  if (m && m.expires > now) return m.value;
  const d = await idb.get<CacheEntry<T>>('cache', key).catch(() => undefined);
  return d && d.expires > now ? d.value : undefined;
}
