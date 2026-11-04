/**
 * Background entry (Chromium service worker / Firefox event page).
 * Routes typed RPC messages to the FACEIT client and services.
 */
import type { RpcMap, RpcMethod, RpcRequest, RpcResponse } from '@shared/rpc';
import { getSettings } from '@shared/settings';
import { ext, getURL, notify, onMessage, openTab } from '@ext/compat/browser';
import { clearCache, idb, pruneCache } from './db';
import { FaceitClient } from './faceit-client';
import { HttpError } from './rate-limiter';
import { analyzeLobby, analyzePvp, lobbyIntelFor } from './services';
import { ConfigError, resolveKey } from './transport';

const client = new FaceitClient(getSettings);

type Handlers = { [M in RpcMethod]: (p: RpcMap[M]['req'], sender: chrome.runtime.MessageSender) => Promise<RpcMap[M]['res']> };

const handlers: Handlers = {
  'player.resolve': (p) => client.resolvePlayer(p.query, p.force),
  'player.search': (p) => client.search(p.query),
  'player.lifetime': (p) => client.lifetime(p.id, p.force),
  'player.recent': (p) => client.recentStats(p.id, p.limit, p.force),
  'player.history': (p) => client.historyPage(p.id, { offset: p.offset, limit: p.limit }),
  'player.elo': (p) => client.eloHistory(p.id),
  'match.details': (p) => client.match(p.id, p.force),
  'match.stats': (p) => client.matchStats(p.id),
  'pvp.analyze': async (p) => analyzePvp(client, await getSettings(), p),
  'lobby.analyze': (p) => analyzeLobby(client, p.matchId, p.force),
  'lobby.intel': async (p) => lobbyIntelFor(client, await getSettings(), p.matchId, !!p.scanOlder),
  'api.status': async () => ({ keySource: resolveKey(await getSettings()).source }),
  'ui.openDashboard': async (p) => {
    await openTab(getURL(`dashboard/index.html${p.hash ? `#${p.hash.replace(/^#/, '')}` : ''}`));
    return true;
  },
  'notify.matchFound': async (p) => {
    const s = await getSettings();
    if (s.autoAccept.notify) {
      await notify(`match-${Date.now()}`, {
        title: p.accepted ? 'SykosTracker · Partida aceptada' : 'SykosTracker · ¡Partida encontrada!',
        message: p.accepted ? 'Auto Accept ha pulsado "Aceptar" por ti.' : 'Vuelve a FACEIT y acepta la partida.',
        requireInteraction: !p.accepted,
      });
    }
    return true;
  },
  'cache.clear': async () => {
    await clearCache();
    await idb.clear('history');
    return true;
  },
  'api.test': async () => {
    try {
      const s = await getSettings();
      const probe = s.myNickname || 's1mple';
      const p = await client.resolvePlayer(probe, true);
      return { ok: true, message: `Conexión directa con FACEIT correcta. Encontrado: ${p.nickname}${p.elo ? ` (${p.elo} ELO)` : ''}.` };
    } catch (e) {
      return { ok: false, message: String((e as Error).message) };
    }
  },
};

function errorCode(e: unknown): string {
  if (e instanceof ConfigError) return 'NOT_CONFIGURED';
  if (e instanceof HttpError) return e.status === 404 ? 'NOT_FOUND' : e.status === 429 ? 'RATE_LIMITED' : `HTTP_${e.status}`;
  if (e instanceof TypeError) return 'NETWORK';
  return 'INTERNAL';
}

onMessage((msg: RpcRequest, sender) => {
  if (!msg || msg.__sykos !== 1 || !(msg.method in handlers)) return undefined;
  // Only accept messages from our own extension contexts.
  if (sender.id && sender.id !== ext.runtime.id) return undefined;
  const h = handlers[msg.method] as (p: unknown, s: chrome.runtime.MessageSender) => Promise<unknown>;
  return h(msg.params, sender).then(
    (data): RpcResponse<unknown> => ({ ok: true, data }),
    (e): RpcResponse<unknown> => ({ ok: false, error: { code: errorCode(e), message: String(e?.message ?? e) } }),
  );
});

ext.runtime.onInstalled.addListener((details) => {
  ext.alarms.create('sykos-prune', { periodInMinutes: 360 });
  if (details.reason === 'install') void openTab(getURL('dashboard/index.html#settings'));
});

ext.alarms.onAlarm.addListener((a) => {
  if (a.name === 'sykos-prune') void pruneCache();
});
