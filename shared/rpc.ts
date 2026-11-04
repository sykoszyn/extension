/**
 * Typed RPC contract between UI contexts (content script, popup, dashboard)
 * and the background worker. All network I/O happens in the background so
 * caching and rate limiting are global to the browser profile.
 */
import type { LobbyTeam, PvpResult } from './types/analytics';
import type {
  EloSnapshot,
  HistoryMatch,
  LifetimeStats,
  MatchDetails,
  MatchStatLine,
  MatchStats,
  PlayerProfile,
  SearchHit,
} from './types/faceit';
import { ext } from '@ext/compat/browser';

export interface RpcMap {
  'player.resolve': { req: { query: string; force?: boolean }; res: PlayerProfile };
  'player.search': { req: { query: string }; res: SearchHit[] };
  'player.lifetime': { req: { id: string; force?: boolean }; res: LifetimeStats };
  'player.recent': { req: { id: string; limit: number; force?: boolean }; res: MatchStatLine[] };
  'player.history': { req: { id: string; offset: number; limit: number }; res: HistoryMatch[] };
  'player.elo': { req: { id: string }; res: EloSnapshot[] };
  'match.details': { req: { id: string; force?: boolean }; res: MatchDetails };
  'match.stats': { req: { id: string }; res: MatchStats | null };
  'pvp.analyze': {
    req: { meId: string; otherId: string; since?: number; scanOlder?: boolean; loadStats?: boolean };
    res: PvpResult;
  };
  'lobby.analyze': { req: { matchId: string; force?: boolean }; res: { match: MatchDetails; teams: LobbyTeam[] } };
  'ui.openDashboard': { req: { hash?: string }; res: true };
  'notify.matchFound': { req: { accepted: boolean }; res: true };
  'cache.clear': { req: Record<string, never>; res: true };
  'api.test': { req: Record<string, never>; res: { ok: boolean; message: string } };
}

export type RpcMethod = keyof RpcMap;

export interface RpcRequest<M extends RpcMethod = RpcMethod> {
  __sykos: 1;
  method: M;
  params: RpcMap[M]['req'];
}

export type RpcResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export class RpcError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function rpc<M extends RpcMethod>(method: M, params: RpcMap[M]['req']): Promise<RpcMap[M]['res']> {
  const msg: RpcRequest<M> = { __sykos: 1, method, params };
  let res: RpcResponse<RpcMap[M]['res']> | undefined;
  try {
    res = await ext.runtime.sendMessage(msg);
  } catch (e) {
    throw new RpcError('EXTENSION', 'La extensión se ha actualizado o reiniciado. Recarga la página.');
  }
  if (!res) throw new RpcError('NO_RESPONSE', 'Sin respuesta del servicio en segundo plano.');
  if (!res.ok) throw new RpcError(res.error.code, res.error.message);
  return res.data;
}
