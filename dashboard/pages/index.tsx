/**
 * Dashboard pages. Each page is thin: it picks the subject (player/match)
 * from the route or settings and composes feature components.
 */
import { useEffect, useState } from 'react';
import { storageGet } from '@ext/compat/browser';
import { MATCH_ID_RE, parseSearchInput } from '@shared/utils/faceit-url';
import { relative } from '@shared/utils/format';
import type { Settings } from '@shared/types/settings';
import { useRpc } from '../hooks/useRpc';
import { useFavorites } from '../hooks/useSettings';
import { navigate } from '../hooks/useHashRoute';
import { LobbyView } from '../components/LobbyView';
import { MapPerformance } from '../components/MapPerformance';
import { MatchHistory } from '../components/MatchHistory';
import { MapTable, PlayerHeader, PlayerOverview } from '../components/PlayerOverview';
import { PlayerSearch } from '../components/PlayerSearch';
import { PvpPanel } from '../components/PvpPanel';
import { Avatar, Card, Empty, ErrorBox, Skeleton } from '../components/ui';
import { getRecentSearches, clearRecentSearches, updateSettings } from '@shared/settings';
import { NicknameForm } from '../components/Simple';
import { useSettings as useSettingsLite } from '../hooks/useSettings';
import type { RecentSearch } from '@shared/types/settings';

export { SettingsPage } from './Settings';

/** First run: ask only for the nickname, right here. */
function NeedMe() {
  const { settings } = useSettingsLite();
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <Card title="Empieza aquí">
        <p className="mb-3 text-[13px] text-fog-400">Escribe tu nickname de FACEIT. No hace falta cuenta ni contraseña.</p>
        <NicknameForm settings={settings} update={updateSettings} autoFocus />
      </Card>
    </div>
  );
}

export function FavButton({ id, nickname, avatar }: { id: string; nickname: string; avatar: string | null }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(id);
  return (
    <button className={fav ? 'st-btn-primary' : 'st-btn-ghost'} onClick={() => toggle({ id, nickname, avatar })} aria-pressed={fav}>
      {fav ? '★ Favorito' : '☆ Favorito'}
    </button>
  );
}

function PlayerActions({ id, nickname, avatar, meId }: { id: string; nickname: string; avatar: string | null; meId: string }) {
  return (
    <>
      <FavButton id={id} nickname={nickname} avatar={avatar} />
      {meId && meId !== id && (
        <button className="st-btn-primary" onClick={() => navigate('compare', id)}>
          Comparar conmigo
        </button>
      )}
      <button className="st-btn-ghost" onClick={() => navigate('history', id)}>
        Historial
      </button>
      <button className="st-btn-ghost" onClick={() => navigate('maps', id)}>
        Mapas
      </button>
    </>
  );
}

export function OverviewPage({ arg, settings }: { arg: string | null; settings: Settings }) {
  const subject = arg ?? settings.myPlayerId;
  if (!subject) return <NeedMe />;
  return <PlayerOverview key={subject} query={subject} actions={(p) => <PlayerActions id={p.id} nickname={p.nickname} avatar={p.avatar} meId={settings.myPlayerId} />} />;
}

export function ComparePage({ arg, settings }: { arg: string | null; settings: Settings }) {
  if (!settings.myPlayerId) return <NeedMe />;
  return (
    <div className="space-y-4">
      <Card title="Comparar jugador" className="z-30">
        <p className="mb-3 text-[13px] text-fog-400">Busca a un jugador para ver cuántas veces habéis jugado juntos o en contra.</p>
        <PlayerSearch onSelect={(r) => (r.kind === 'player' ? navigate('compare', r.id) : navigate('lobby', r.id))} autoFocus={!arg} />
      </Card>
      {arg ? <PvpPanel key={arg} meId={settings.myPlayerId} otherId={arg} /> : <FavoritesPage settings={settings} />}
    </div>
  );
}

function SubjectPicker({ page, settings, arg }: { page: 'history' | 'maps'; settings: Settings; arg: string | null }) {
  const profile = useRpc('player.resolve', arg ? { query: arg } : null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-[260px] flex-1">
        <PlayerSearch onSelect={(r) => r.kind === 'player' && navigate(page, r.id)} placeholder="Ver otro jugador…" />
      </div>
      {arg && settings.myPlayerId && arg !== settings.myPlayerId && (
        <button className="st-btn-ghost" onClick={() => navigate(page)}>
          Volver a mí
        </button>
      )}
      {profile.data && (
        <span className="flex items-center gap-2 text-[13px] text-fog-400">
          <Avatar src={profile.data.avatar} name={profile.data.nickname} size={22} /> {profile.data.nickname}
        </span>
      )}
    </div>
  );
}

export function HistoryPage({ arg, settings }: { arg: string | null; settings: Settings }) {
  const id = arg ?? settings.myPlayerId;
  if (!id) return <NeedMe />;
  return (
    <div className="space-y-4">
      <SubjectPicker page="history" settings={settings} arg={arg} />
      <MatchHistory key={id} playerId={id} onOpenPlayer={(pid) => navigate('overview', pid)} />
    </div>
  );
}

export function MapsPage({ arg, settings }: { arg: string | null; settings: Settings }) {
  const id = arg ?? settings.myPlayerId;
  const profile = useRpc('player.resolve', id ? { query: id } : null);
  const recent = useRpc('player.recent', id ? { id, limit: 100 } : null);
  const lifetime = useRpc('player.lifetime', id ? { id } : null);
  if (!id) return <NeedMe />;
  return (
    <div className="space-y-4">
      <SubjectPicker page="maps" settings={settings} arg={arg} />
      {profile.data && <PlayerHeader profile={profile.data} compact />}
      <Card title="Map Performance · partidas recientes">
        {recent.error ? <ErrorBox error={recent.error} onRetry={() => recent.reload()} /> : recent.data ? <MapPerformance lines={recent.data} lifetime={lifetime.data} windows={['5', '10', '20', '50', '100']} /> : <Skeleton className="h-64" />}
      </Card>
      {lifetime.data && (
        <Card title="Rendimiento por mapa · lifetime" pad={false}>
          <MapTable lifetime={lifetime.data} />
        </Card>
      )}
    </div>
  );
}

export function LobbyPage({ arg, settings }: { arg: string | null; settings: Settings }) {
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [last, setLast] = useState<{ matchId: string; at: number } | null>(null);
  useEffect(() => {
    storageGet<{ matchId: string; at: number } | null>('sykos.lastRoom', null).then(setLast);
  }, []);
  const open = () => {
    const p = parseSearchInput(input);
    if (p.kind === 'match') {
      setErr(null);
      navigate('lobby', p.value);
    } else setErr('Pega la URL de una sala de FACEIT (…/cs2/room/1-…) o el ID de la partida.');
  };
  return (
    <div className="space-y-4">
      <Card title="Lobby Analyzer">
        <p className="mb-3 text-[13px] text-fog-400">
          Al entrar en una sala de FACEIT, SykosTracker muestra el análisis automáticamente sobre la propia página. Aquí puedes abrir cualquier sala por URL o ID.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            open();
          }}
        >
          <input className="st-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://www.faceit.com/es/cs2/room/1-…" />
          <button className="st-btn-primary">Analizar</button>
        </form>
        {err && <p className="mt-1 text-[12px] text-blood-400">{err}</p>}
        {last && last.matchId !== arg && (
          <button className="mt-3 text-[12px] text-ember-400 hover:underline" onClick={() => navigate('lobby', last.matchId)}>
            Última sala detectada en FACEIT ({relative(last.at)}): {last.matchId}
          </button>
        )}
      </Card>
      {arg && MATCH_ID_RE.test(arg) ? (
        <LobbyView key={arg} matchId={arg} myPlayerId={settings.myPlayerId} onOpenPlayer={(id) => navigate('overview', id)} />
      ) : (
        <Empty title="Ninguna sala seleccionada" />
      )}
    </div>
  );
}

export function FavoritesPage({ settings }: { settings: Settings }) {
  const { favorites, toggle } = useFavorites();
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  useEffect(() => {
    getRecentSearches().then(setRecent);
  }, []);
  const Row = ({ p, fav }: { p: { id: string; nickname: string; avatar: string | null }; fav: boolean }) => (
    <li className="flex flex-wrap items-center gap-3 border-t border-white/[0.05] px-4 py-2.5 first:border-0">
      <Avatar src={p.avatar} name={p.nickname} size={32} />
      <button className="flex-1 text-left font-semibold hover:text-ember-400" onClick={() => navigate('overview', p.id)}>
        {p.nickname}
      </button>
      {settings.myPlayerId && settings.myPlayerId !== p.id && (
        <button className="st-btn-ghost !py-1" onClick={() => navigate('compare', p.id)}>
          VS
        </button>
      )}
      <button className="st-btn-ghost !py-1" onClick={() => navigate('history', p.id)}>
        Historial
      </button>
      <button className="st-btn-ghost !py-1" onClick={() => navigate('maps', p.id)}>
        Mapas
      </button>
      <button className={fav ? 'st-btn-primary !py-1' : 'st-btn-ghost !py-1'} onClick={() => toggle(p)} aria-label={fav ? 'Quitar de favoritos' : 'Añadir a favoritos'}>
        {fav ? '★' : '☆'}
      </button>
    </li>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`Favoritos (${favorites.length})`} pad={false}>
        {favorites.length ? (
          <ul>
            {favorites.map((f) => (
              <Row key={f.id} p={f} fav />
            ))}
          </ul>
        ) : (
          <div className="p-4">
            <Empty title="Sin favoritos" body="Marca jugadores con ☆ desde su perfil para tenerlos a mano." />
          </div>
        )}
      </Card>
      <Card
        title="Búsquedas recientes"
        pad={false}
        right={
          recent.length > 0 && (
            <button className="text-[12px] text-fog-400 hover:text-fog-100" onClick={() => clearRecentSearches().then(() => setRecent([]))}>
              Borrar
            </button>
          )
        }
      >
        {recent.length ? (
          <ul>
            {recent.map((r) => (
              <Row key={r.id} p={r} fav={favorites.some((f) => f.id === r.id)} />
            ))}
          </ul>
        ) : (
          <div className="p-4">
            <Empty title="Sin búsquedas" />
          </div>
        )}
      </Card>
    </div>
  );
}
