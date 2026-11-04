/**
 * Dashboard service layer. UI code talks to data exclusively through these
 * functions; all network I/O happens in the background worker via typed RPC.
 */
export { rpc, RpcError } from '@shared/rpc';
export {
  getSettings,
  updateSettings,
  getFavorites,
  toggleFavorite,
  getRecentSearches,
  pushRecentSearch,
  clearRecentSearches,
} from '@shared/settings';
