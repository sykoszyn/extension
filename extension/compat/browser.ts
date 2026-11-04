/**
 * Cross-browser compatibility layer.
 *
 * Verified differences we adapt for (Chrome/Edge/Brave/Opera = Chromium MV3,
 * Firefox = Gecko MV3):
 *  - Namespace: Firefox exposes `browser.*` (promise based); Chromium exposes
 *    `chrome.*` (promise based in MV3 for the APIs we use).
 *  - Background: Chromium runs a service worker (no DOM, may be terminated
 *    after ~30 s idle); Firefox MV3 runs a non-persistent event page declared
 *    with `background.scripts`. Our background code is DOM-free and keeps all
 *    state in storage/IndexedDB, so it works under both lifecycles.
 *  - runtime.onMessage async replies: Chromium needs `return true` +
 *    `sendResponse`; Firefox also accepts that pattern, so we use it for both.
 *  - notifications: Firefox ignores `buttons`, `requireInteraction` and
 *    `silent`; we strip them there.
 *  - storage.session exists in Chrome ≥102 and Firefox ≥115; we feature-detect.
 */

type Api = typeof chrome;

const g = globalThis as unknown as { browser?: Api; chrome?: Api };

export const ext: Api = (g.browser ?? g.chrome) as Api;

export const isFirefox: boolean =
  typeof g.browser !== 'undefined' && typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

export function hasSessionStorage(): boolean {
  return !!ext?.storage?.session;
}

export async function storageGet<T>(key: string, fallback: T): Promise<T> {
  const out = await ext.storage.local.get(key);
  return (out?.[key] as T | undefined) ?? fallback;
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  await ext.storage.local.set({ [key]: value });
}

export function onStorageChange(key: string, cb: (value: unknown) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && key in changes) cb(changes[key].newValue);
  };
  ext.storage.onChanged.addListener(listener);
  return () => ext.storage.onChanged.removeListener(listener);
}

export function getURL(path: string): string {
  return ext.runtime.getURL(path);
}

export async function openTab(url: string): Promise<void> {
  await ext.tabs.create({ url });
}

export interface NotifyOptions {
  title: string;
  message: string;
  requireInteraction?: boolean;
}

export async function notify(id: string, o: NotifyOptions): Promise<void> {
  if (!ext.notifications) return;
  const base: chrome.notifications.NotificationCreateOptions = {
    type: 'basic',
    iconUrl: getURL('icons/icon-128.png'),
    title: o.title,
    message: o.message,
  };
  if (!isFirefox && o.requireInteraction) base.requireInteraction = true;
  try {
    await ext.notifications.create(id, base);
  } catch {
    /* notifications may be disabled at OS level — not fatal */
  }
}

/**
 * Registers an async message handler in a way that works on both engines.
 * Return `undefined` from `handler` to let other listeners respond.
 */
export function onMessage(handler: (msg: any, sender: chrome.runtime.MessageSender) => Promise<unknown> | undefined) {
  ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const p = handler(msg, sender);
    if (!p) return false;
    p.then(sendResponse, (e) => sendResponse({ ok: false, error: { code: 'INTERNAL', message: String(e?.message ?? e) } }));
    return true;
  });
}
