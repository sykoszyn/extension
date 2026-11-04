import { useEffect, useRef, useState } from 'react';
import { rpc, RpcError } from '@shared/rpc';
import { getRecentSearches, pushRecentSearch } from '@shared/settings';
import type { SearchHit } from '@shared/types/faceit';
import type { RecentSearch } from '@shared/types/settings';
import { parseSearchInput } from '@shared/utils/faceit-url';
import { Avatar, LevelBadge, Spinner } from './ui';

export type SearchResult = { kind: 'player'; id: string; nickname: string } | { kind: 'match'; id: string };

/** Global search: nickname, FACEIT profile URL, room URL or match id. */
export function PlayerSearch({ onSelect, placeholder = 'Nickname, URL de FACEIT o ID de partida…', autoFocus }: { onSelect: (r: SearchResult) => void; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    getRecentSearches().then(setRecent);
  }, [focus]);

  // Debounced fuzzy suggestions (1 request per pause, cached 1 h in background).
  useEffect(() => {
    clearTimeout(timer.current);
    const parsed = parseSearchInput(q);
    if (parsed.kind !== 'nickname' || q.trim().length < 3) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(() => {
      rpc('player.search', { query: parsed.value })
        .then(setHits)
        .catch(() => setHits([]));
    }, 450);
    return () => clearTimeout(timer.current);
  }, [q]);

  const choose = async (hit: { id: string; nickname: string; avatar: string | null }) => {
    await pushRecentSearch(hit);
    setQ('');
    setHits([]);
    setFocus(false);
    (document.activeElement as HTMLElement | null)?.blur?.();
    onSelect({ kind: 'player', id: hit.id, nickname: hit.nickname });
  };

  const submit = async () => {
    const parsed = parseSearchInput(q);
    setError(null);
    if (parsed.kind === 'invalid') return setError('Introduce un nickname válido, una URL de FACEIT o un ID de partida.');
    if (parsed.kind === 'match') {
      setQ('');
      return onSelect({ kind: 'match', id: parsed.value });
    }
    setBusy(true);
    try {
      const p = await rpc('player.resolve', { query: parsed.value });
      await choose({ id: p.id, nickname: p.nickname, avatar: p.avatar });
    } catch (e) {
      setError(e instanceof RpcError && e.code === 'NOT_FOUND' ? `No existe ningún jugador "${parsed.value}" en FACEIT.` : String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const showDrop = focus && (hits.length > 0 || (!q && recent.length > 0));
  return (
    // z-40 + isolate: the suggestion list must float above the cards rendered after the search box.
    <div className="relative isolate z-40 w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="relative"
      >
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="st-input !pl-9 !pr-9"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setFocus(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={placeholder}
          aria-label="Buscar jugador"
        />
        {busy && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2" />}
      </form>
      {error && <p className="mt-1 text-[12px] text-blood-400">{error}</p>}
      {showDrop && (
        <div role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[320px] overflow-y-auto rounded-xl border border-white/10 bg-ink-800 shadow-[0_20px_50px_-10px_rgba(0,0,0,.9)]">
          {!q && <div className="st-label px-3 pt-2">Búsquedas recientes</div>}
          {(q ? hits : recent).map((h) => (
            <button key={h.id} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.05]" onMouseDown={(e) => e.preventDefault()} onClick={() => void choose(h)}>
              <Avatar src={h.avatar} name={h.nickname} size={26} />
              <span className="flex-1 truncate font-semibold">{h.nickname}</span>
              {'level' in h && <LevelBadge level={h.level} size={20} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
