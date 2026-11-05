import type { ReactNode } from 'react';
import type { LifetimeStats, MatchStatLine, PlayerProfile } from '@shared/types/faceit';
import { currentStreak, formSummary } from '@shared/utils/analytics';
import { date, fmt, pct, ratio, relative } from '@shared/utils/format';
import { mapLabel } from '@shared/utils/maps';
import { EloChart, FormChart } from '../charts';
import { useRpc } from '../hooks/useRpc';
import { LevelBar } from './LevelBar';
import { Avatar, Card, Empty, ErrorBox, Flag, FormStrip, LevelBadge, MapBadge, Notice, Skeleton, SkeletonGrid, Source, StatTile, cx } from './ui';

export function PlayerHeader({ profile, actions, compact }: { profile: PlayerProfile; actions?: ReactNode; compact?: boolean }) {
  return (
    <div className={cx('st-card st-glow overflow-hidden', compact ? 'p-3' : 'p-5')}>
      <div className="absolute inset-0 st-hatch opacity-40" />
      <div className="relative flex flex-wrap items-center gap-4">
        <Avatar src={profile.avatar} name={profile.nickname} size={compact ? 44 : 64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className={cx('truncate font-display font-bold uppercase tracking-wide text-fog-100', compact ? 'text-[20px]' : 'text-[28px] leading-none')}>{profile.nickname}</h2>
            <Flag country={profile.country} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-fog-400">
            {profile.region && <span>{profile.region}</span>}
            {profile.steamNickname && <span>Steam: {profile.steamNickname}</span>}
            <a className="text-ember-400 hover:underline" href={profile.faceitUrl} target="_blank" rel="noreferrer">
              Perfil FACEIT ↗
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LevelBadge level={profile.level} size={compact ? 34 : 44} />
          <div className="text-right">
            <div className="st-label">ELO</div>
            <div className={cx('st-num text-ember-400', compact ? 'text-[22px]' : 'text-[30px] leading-none')}>{fmt(profile.elo)}</div>
          </div>
        </div>
        {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
      </div>
      <LevelBar elo={profile.elo} className="relative mt-3" />
    </div>
  );
}

export function KpiGrid({ lifetime, recent }: { lifetime: LifetimeStats; recent: MatchStatLine[] }) {
  const form = formSummary(recent.slice(0, 20));
  const streak = currentStreak(recent.map((r) => r.win));
  const streakLabel = streak.type ? `${streak.length} ${streak.type === 'win' ? 'V' : 'D'}` : '—';
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Partidas" value={fmt(lifetime.matches)} sub={`${fmt(lifetime.wins)} V · ${fmt(lifetime.losses)} D`} />
        <StatTile label="Win rate" value={pct(lifetime.winRate)} hint="Lifetime CS2, según FACEIT." />
        <StatTile label="K/D" value={ratio(lifetime.kd)} sub={`Últ. 20: ${ratio(form.kd)}`} />
        <StatTile label="HS%" value={pct(lifetime.hsPercent)} sub={`Últ. 20: ${pct(form.hsPercent)}`} />
        <StatTile label="ADR" value={fmt(lifetime.adr ?? form.adr, 1)} sub={lifetime.adr === null ? 'Lifetime no disponible · mostrando últ. 20' : `Últ. 20: ${fmt(form.adr, 1)}`} />
        <StatTile label="K/R (últ. 20)" value={ratio(form.kr)} hint="FACEIT no da K/R lifetime fiable; se calcula sobre las últimas 20 partidas." />
        <StatTile
          label="Racha actual"
          value={streakLabel}
          tone={streak.type === 'win' ? 'up' : streak.type === 'loss' ? 'down' : undefined}
          sub={`Mejor racha de victorias: ${fmt(lifetime.longestWinStreak)}`}
          hint="Calculada sobre las últimas partidas registradas."
        />
        <StatTile label="Forma (últ. 20)" value={pct(form.winRate)} sub={`${form.wins} V · ${form.losses} D`} tone={form.winRate !== null ? (form.winRate >= 50 ? 'up' : 'down') : undefined} />
      </div>
    </div>
  );
}

export function MapTable({ lifetime }: { lifetime: LifetimeStats }) {
  if (!lifetime.maps.length) return <Empty title="Sin datos por mapa" body="FACEIT no devolvió segmentos de mapa para este jugador." />;
  return (
    <div className="st-scroll overflow-x-auto">
      <table className="st-table w-full text-[13px]">
        <thead>
          <tr>
            <th>Mapa</th>
            <th className="!text-right">Partidas</th>
            <th className="!text-right">Win rate</th>
            <th className="!text-right">K/D</th>
            <th className="!text-right">ADR</th>
            <th className="!text-right">HS%</th>
          </tr>
        </thead>
        <tbody>
          {lifetime.maps.map((m) => (
            <tr key={m.map} className="hover:bg-white/[0.02]">
              <td>
                <div className="flex items-center gap-2">
                  <MapBadge map={m.map} size="sm" />
                  {mapLabel(m.map)}
                </div>
              </td>
              <td className="text-right">{fmt(m.matches)}</td>
              <td className={cx('text-right', m.winRate !== null && (m.winRate >= 50 ? 'text-win' : 'text-loss'))}>{pct(m.winRate)}</td>
              <td className="text-right">{ratio(m.kd)}</td>
              <td className="text-right">{fmt(m.adr, 1)}</td>
              <td className="text-right">{pct(m.hsPercent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Full player profile block — used by the dashboard and the in-page FACEIT panel. */
export function PlayerOverview({ query, compact, actions }: { query: string; compact?: boolean; actions?: (p: PlayerProfile) => ReactNode }) {
  const profile = useRpc('player.resolve', query ? { query } : null);
  const id = profile.data?.id;
  const lifetime = useRpc('player.lifetime', id ? { id } : null);
  const recent = useRpc('player.recent', id ? { id, limit: 20 } : null);
  const elo = useRpc('player.elo', id ? { id } : null);

  if (profile.error) return <ErrorBox error={profile.error} onRetry={() => profile.reload()} />;
  if (!profile.data) return (
    <div className="space-y-3">
      <Skeleton className="h-24" />
      <SkeletonGrid />
    </div>
  );

  const p = profile.data;
  const lines = recent.data ?? [];
  return (
    <div className="space-y-3">
      <PlayerHeader profile={p} compact={compact} actions={actions?.(p)} />

      {lifetime.error ? (
        <ErrorBox error={lifetime.error} onRetry={() => lifetime.reload()} />
      ) : !lifetime.data || recent.loading ? (
        <SkeletonGrid />
      ) : (
        <Card title="Estadísticas CS2">
          <KpiGrid lifetime={lifetime.data} recent={lines} />
          <Source>
            FACEIT Data API · lifetime CS2 y últimas {lines.length} partidas · actualizado {relative(Math.max(p.fetchedAt, lifetime.data.fetchedAt))}
          </Source>
        </Card>
      )}

      <div className={cx('grid gap-3', !compact && 'lg:grid-cols-2')}>
        <Card title="Rendimiento reciente · K/D por partida" right={<span className="text-[11px] text-fog-500">antigua → reciente</span>}>
          {recent.error ? (
            <ErrorBox error={recent.error} onRetry={() => recent.reload()} />
          ) : recent.loading ? (
            <Skeleton className="h-[170px]" />
          ) : lines.length ? (
            <>
              <FormChart lines={lines} />
              <div className="mt-2">
                <FormStrip results={lines.map((l) => l.win)} />
              </div>
              <Source>FACEIT · últimas {lines.length} partidas CS2 · línea discontinua = K/D 1.0</Source>
            </>
          ) : (
            <Empty title="Sin partidas recientes" />
          )}
        </Card>

        <Card title="Evolución del ELO">
          {elo.data && elo.data.length >= 2 ? (
            <>
              <EloChart data={elo.data} />
              <Source>
                ELO observado por SykosTracker en {elo.data.length} lecturas desde {date(elo.data[0].t)}. FACEIT Data API no publica el ELO por partida.
              </Source>
            </>
          ) : (
            <Notice>
              La API de datos de FACEIT solo expone el <b>ELO actual</b>, no el histórico. SykosTracker registra el ELO cada vez que consultas a este jugador; el gráfico aparecerá
              a partir de la segunda lectura distinta.{elo.data?.length === 1 && ` Primera lectura: ${fmt(elo.data[0].elo)} ELO (${date(elo.data[0].t)}).`}
            </Notice>
          )}
        </Card>
      </div>

      {lifetime.data && (
        <Card title="Rendimiento por mapa · lifetime" pad={false}>
          <MapTable lifetime={lifetime.data} />
          <div className="px-4 pb-3">
            <Source>FACEIT Data API · segmentos por mapa (5v5) · todo el historial CS2</Source>
          </div>
        </Card>
      )}
    </div>
  );
}
