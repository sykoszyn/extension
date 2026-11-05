import type { ReactNode } from 'react';
import { t } from '@shared/i18n';
import type { LifetimeStats, MatchStatLine, PlayerProfile } from '@shared/types/faceit';
import { currentStreak, formSummary } from '@shared/utils/analytics';
import { date, fmt, pct, ratio } from '@shared/utils/format';
import { mapLabel } from '@shared/utils/maps';
import { EloChart, FormChart } from '../charts';
import { useRpc } from '../hooks/useRpc';
import { LevelBar } from './LevelBar';
import { Avatar, Card, Empty, ErrorBox, Flag, FormStrip, LevelBadge, MapBadge, Notice, Skeleton, SkeletonGrid, StatTile, cx } from './ui';

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
              {t('faceitProfile')} ↗
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
  const streakLabel = streak.type ? `${streak.length}${streak.type === 'win' ? t('w') : t('l')}` : '—';
  const last20 = (v: string) => `${t('last20')}: ${v}`;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatTile label={t('stat.matches')} value={fmt(lifetime.matches)} sub={t('wl', { w: fmt(lifetime.wins), l: fmt(lifetime.losses) })} />
      <StatTile label={t('stat.winRate')} value={pct(lifetime.winRate)} />
      <StatTile label="K/D" value={ratio(lifetime.kd)} sub={last20(ratio(form.kd))} />
      <StatTile label="HS%" value={pct(lifetime.hsPercent)} sub={last20(pct(form.hsPercent))} />
      <StatTile label="ADR" value={fmt(lifetime.adr ?? form.adr, 1)} sub={last20(fmt(form.adr, 1))} />
      <StatTile label={`K/R · ${t('last20')}`} value={ratio(form.kr)} />
      <StatTile
        label={t('stat.streak')}
        value={streakLabel}
        tone={streak.type === 'win' ? 'up' : streak.type === 'loss' ? 'down' : undefined}
        sub={t('stat.bestStreak', { n: fmt(lifetime.longestWinStreak) })}
      />
      <StatTile
        label={`${t('stat.form')} · ${t('last20')}`}
        value={pct(form.winRate)}
        sub={t('wl', { w: form.wins, l: form.losses })}
        tone={form.winRate !== null ? (form.winRate >= 50 ? 'up' : 'down') : undefined}
      />
    </div>
  );
}

export function MapTable({ lifetime }: { lifetime: LifetimeStats }) {
  if (!lifetime.maps.length) return <Empty title={t('maps.none')} />;
  return (
    <div className="st-scroll overflow-x-auto">
      <table className="st-table w-full text-[13px]">
        <thead>
          <tr>
            <th>{t('col.map')}</th>
            <th className="!text-right">{t('stat.matches')}</th>
            <th className="!text-right">{t('stat.winRate')}</th>
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
  if (!profile.data)
    return (
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
        <Card title={t('profile.stats')}>
          <KpiGrid lifetime={lifetime.data} recent={lines} />
        </Card>
      )}

      <div className={cx('grid gap-3', !compact && 'lg:grid-cols-2')}>
        <Card title={t('profile.recent')} right={<span className="text-[11px] text-fog-500">{t('profile.oldToNew')}</span>}>
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
            </>
          ) : (
            <Empty title={t('profile.noRecent')} />
          )}
        </Card>

        <Card title={t('profile.elo')}>
          {elo.data && elo.data.length >= 2 ? (
            <EloChart data={elo.data} />
          ) : (
            <Notice>
              {t('profile.eloNote')}
              {elo.data?.length === 1 && ` ${t('profile.eloFirst', { elo: fmt(elo.data[0].elo), date: date(elo.data[0].t) })}`}
            </Notice>
          )}
        </Card>
      </div>

      {lifetime.data && (
        <Card title={t('profile.mapsLifetime')} pad={false}>
          <MapTable lifetime={lifetime.data} />
        </Card>
      )}
    </div>
  );
}
