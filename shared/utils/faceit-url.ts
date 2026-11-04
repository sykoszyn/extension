/**
 * Recognises FACEIT web URLs. Used by the content script router and the
 * global search box (which accepts a nickname OR a FACEIT URL).
 */

export type FaceitRoute =
  | { kind: 'profile'; nickname: string }
  | { kind: 'room'; matchId: string }
  | { kind: 'other' };

const PROFILE_RE = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?players(?:-modal)?\/([^/?#]+)/i;
const ROOM_RE = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?cs2\/room\/([^/?#]+)/i;
/** FACEIT match ids: "1-" + uuid (current) or a bare uuid (legacy). */
export const MATCH_ID_RE = /^(?:\d-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NICKNAME_RE = /^[A-Za-z0-9_\-.]{2,32}$/;

export function parseFaceitPath(pathname: string): FaceitRoute {
  const room = ROOM_RE.exec(pathname);
  if (room && MATCH_ID_RE.test(decodeURIComponent(room[1]))) {
    return { kind: 'room', matchId: decodeURIComponent(room[1]) };
  }
  const prof = PROFILE_RE.exec(pathname);
  if (prof) return { kind: 'profile', nickname: decodeURIComponent(prof[1]) };
  return { kind: 'other' };
}

export type SearchInput =
  | { kind: 'nickname'; value: string }
  | { kind: 'match'; value: string }
  | { kind: 'invalid' };

/** Accepts "nick", "https://www.faceit.com/es/players/nick/stats/cs2", a room URL or a match id. */
export function parseSearchInput(input: string): SearchInput {
  const s = input.trim();
  if (!s) return { kind: 'invalid' };
  if (MATCH_ID_RE.test(s)) return { kind: 'match', value: s };
  if (/faceit\.com/i.test(s)) {
    try {
      const url = new URL(s.startsWith('http') ? s : `https://${s}`);
      const route = parseFaceitPath(url.pathname);
      if (route.kind === 'profile') return { kind: 'nickname', value: route.nickname };
      if (route.kind === 'room') return { kind: 'match', value: route.matchId };
    } catch {
      /* fallthrough */
    }
    return { kind: 'invalid' };
  }
  return NICKNAME_RE.test(s) ? { kind: 'nickname', value: s } : { kind: 'invalid' };
}
