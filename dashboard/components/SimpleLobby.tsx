/**
 * Simple match-room view: the 10 players, each with their LAST 10 MAPS —
 * results as W/L squares plus WR, K/D, ADR and HS% over those 10 matches —
 * and a Rival-Tracker style badge when you already met that player.
 */
import { useEffect, useMemo } from 'react';
import type { LobbyPlayer, LobbyTeam } from '@shared/types/analytics';
import { formSummary } from '@shared/utils/analytics';
import type { Encounter } from '@shared/utils/encounters';
import { fmt, pct, ratio } from '@shared/utils/format';
import { mapLabel } from '@shared/utils/maps';
import { t } from '@shared/i18n';
import { SERIES } from '../charts';
import { useRpc } from '../hooks/useRpc';
import { Avatar, ErrorBox, LevelBadge, MapBadge, Skeleton, Spinner, cx } from './ui';

const WINDOW = 10;
const LIVE = new Set(['VOTING', 'CONFIGURING', 'READY', 'CHECK_IN', 'SUBSTITUTION', 'ONGOING', 'CAPTAIN_PICK']);

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function Last10({ p }: { p: LobbyPlayer }) {
  const lines = p.recent.slice(0, WINDOW);
  return (
    <div className="flex gap-[3px]" aria-label={t('lobby.lastMaps')}>
      {Array.from({ length: WINDOW }, (_, i) => {
        const l = lines[i];
        if (!l) return <span key={i} className="h-[18px] w-[18px] rounded-[4px] bg-white/[0.04]" />;
        const tip = `${mapLabel(l.map)} · ${l.score ?? ''} · K/D ${ratio(l.kd)} · ADR ${fmt(l.adr, 0)}`;
        return (
          <span
            key={i}
            title={tip}
            className={cx(
              'grid h-[18px] w-[18px] place-items-center rounded-[4px] text-[9px] font-bold',
              l.win === null ? 'bg-white/10 text-fog-500' : l.win ? 'bg-win/20 text-win' : 'bg-loss/20 text-loss',
            )}
          >
            {l.win === null ? '–' : l.win ? t('w') : t('l')}
          </span>
        );
      })}
    </div>
  );
}

function tone(v: number | null, good: number, bad: number) {
  if (v === null) return 'text-fog-500';
  return v >= good ? 'text-win' : v <= bad ? 'text-loss' : 'text-fog-100';
}

/** Rival-Tracker style badge: have you met this player before? */
function MetBadge({ e }: { e: Encounter | undefined }) {
  if (!e || (e.rival.count === 0 && e.together === 0)) return null;
  const tip = [
    e.rival.count ? t('met.rivalTip', { n: e.rival.count, w: e.rival.wins, l: e.rival.losses }) : '',
    e.together ? t('met.withTip', { n: e.together }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span title={tip} className="flex shrink-0 gap-1">
      {e.rival.count > 0 && <span className="rounded bg-blood-500/15 px-1 text-[9px] font-bold uppercase text-blood-400">{t('met.vs', { n: e.rival.count })}</span>}
      {e.together > 0 && <span className="rounded bg-white/[0.07] px-1 text-[9px] font-bold uppercase text-fog-300">{t('met.with', { n: e.together })}</span>}
    </span>
  );
}

function TeamTable({
  team,
  label,
  accent,
  myId,
  met,
  onOpenPlayer,
}: {
  team: LobbyTeam;
  label: string;
  accent: string;
  myId: string;
  met: Record<string, Encounter>;
  onOpenPlayer?: (id: string) => void;
}) {
  const rows = team.players.map((p) => ({ p, f: formSummary(p.recent.slice(0, WINDOW)) }));
  const avg = {
    elo: mean(team.players.map((p) => p.profile?.elo ?? null)),
    wr: mean(rows.map((r) => r.f.winRate)),
    kd: mean(rows.map((r) => r.f.kd)),
    adr: mean(rows.map((r) => r.f.adr)),
    hs: mean(rows.map((r) => r.f.hsPercent)),
  };
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-ink-900/80">
      <div className="flex items-center gap-2 px-3 py-2" style={{ boxShadow: `inset 3px 0 0 ${accent}` }}>
        <span className="font-display text-[14px] font-bold uppercase tracking-[0.12em]" style={{ color: accent }}>
          {label}
        </span>
        <span className="text-[11px] text-fog-500">{t('lobby.avgElo', { n: fmt(avg.elo) })}</span>
      </div>
      <table className="w-full table-fixed text-[12px] tabular-nums">
        {/* Fixed widths so both teams' columns line up exactly. */}
        <colgroup>
          <col style={{ width: '33%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '31%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
        </colgroup>
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.12em] text-fog-500">
            <th className="px-3 py-1.5 text-left font-semibold">{t('col.player')}</th>
            <th className="px-2 py-1.5 text-right font-semibold">ELO</th>
            <th className="px-2 py-1.5 text-left font-semibold" title={t('lobby.lastMapsTip')}>
              {t('lobby.lastMaps')}
            </th>
            <th className="px-2 py-1.5 text-right font-semibold">WR</th>
            <th className="px-2 py-1.5 text-right font-semibold">K/D</th>
            <th className="px-2 py-1.5 text-right font-semibold">ADR</th>
            <th className="px-3 py-1.5 text-right font-semibold">HS%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, f }) => {
            const name = p.profile?.nickname ?? p.rosterNickname;
            const me = p.rosterId === myId;
            return (
              <tr key={p.rosterId} className={cx('border-t border-white/[0.05]', me && 'bg-ember-500/[0.06]')}>
                <td className="px-3 py-1.5">
                  <a
                    href={p.profile?.faceitUrl ?? `https://www.faceit.com/es/players/${encodeURIComponent(name)}`}
                    onClick={(ev) => {
                      if (!onOpenPlayer) return;
                      ev.preventDefault();
                      onOpenPlayer(p.rosterId);
                    }}
                    className="flex min-w-0 items-center gap-2 hover:text-ember-300"
                    title={t('lobby.openProfile', { name })}
                  >
                    <Avatar src={p.profile?.avatar ?? p.rosterAvatar} name={name} size={24} />
                    <LevelBadge level={p.profile?.level ?? p.rosterLevel} size={20} />
                    <span className="min-w-0 truncate font-semibold">{name}</span>
                    {me ? (
                      <span className="rounded bg-ember-500/20 px-1 text-[9px] font-bold uppercase text-ember-300">{t('you')}</span>
                    ) : (
                      <MetBadge e={met[p.rosterId]} />
                    )}
                  </a>
                </td>
                <td className="px-2 py-1.5 text-right font-semibold">{fmt(p.profile?.elo)}</td>
                <td className="px-2 py-1.5">
                  <Last10 p={p} />
                </td>
                <td className={cx('px-2 py-1.5 text-right font-semibold', tone(f.winRate, 55, 45))}>{pct(f.winRate)}</td>
                <td className={cx('px-2 py-1.5 text-right font-semibold', tone(f.kd, 1.1, 0.9))}>{ratio(f.kd)}</td>
                <td className={cx('px-2 py-1.5 text-right', tone(f.adr, 85, 70))}>{fmt(f.adr, 0)}</td>
                <td className="px-3 py-1.5 text-right text-fog-300">{pct(f.hsPercent)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-white/[0.08] text-fog-400">
            <td className="px-3 py-1.5 text-[11px] uppercase tracking-wider">{t('lobby.avg')}</td>
            <td className="px-2 py-1.5 text-right">{fmt(avg.elo)}</td>
            <td />
            <td className="px-2 py-1.5 text-right">{pct(avg.wr)}</td>
            <td className="px-2 py-1.5 text-right">{ratio(avg.kd)}</td>
            <td className="px-2 py-1.5 text-right">{fmt(avg.adr, 0)}</td>
            <td className="px-3 py-1.5 text-right">{pct(avg.hs)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function SimpleLobby({ matchId, myPlayerId, onOpenPlayer }: { matchId: string; myPlayerId: string; onOpenPlayer?: (id: string) => void }) {
  const lobby = useRpc('lobby.analyze', { matchId });
  // Loaded separately so the table never waits for the history scan.
  const met = useRpc('lobby.encounters', myPlayerId ? { matchId } : null);
  const status = lobby.data?.match.status;

  // While the veto is running, refresh every 20 s to pick up the chosen map.
  useEffect(() => {
    if (!status || !LIVE.has(status)) return;
    const t = setInterval(() => lobby.reload({ force: true }), 20_000);
    return () => clearInterval(t);
  }, [status, lobby.reload]);

  const ordered = useMemo(() => {
    if (!lobby.data) return null;
    const teams = lobby.data.teams;
    const mine = teams.findIndex((t) => t.players.some((p) => p.rosterId === myPlayerId));
    const sorted = mine === 1 ? [teams[1], teams[0]] : teams;
    return { teams: sorted, labels: mine >= 0 ? [t('lobby.yourTeam'), t('lobby.enemyTeam')] : [sorted[0]?.name ?? 'Team 1', sorted[1]?.name ?? 'Team 2'] };
  }, [lobby.data, myPlayerId]);

  if (lobby.error) return <ErrorBox error={lobby.error} onRetry={() => lobby.reload()} />;
  if (!lobby.data || !ordered)
    return (
      <div className="space-y-2">
        <Skeleton className="h-[230px]" />
        <Skeleton className="h-[230px]" />
        <p className="flex items-center gap-2 text-[12px] text-fog-400">
          <Spinner /> {t('lobby.loading')}
        </p>
      </div>
    );

  const { match } = lobby.data;
  const byId = met.data?.byId ?? {};
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <MapBadge map={match.map} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">{match.map ? mapLabel(match.map) : t('lobby.veto')}</div>
          <div className="text-[11px] text-fog-500">{t('lobby.subtitle')}</div>
        </div>
        {(lobby.loading || met.loading) && <Spinner />}
      </div>
      <TeamTable team={ordered.teams[0]} label={ordered.labels[0]} accent={SERIES.you} myId={myPlayerId} met={byId} onOpenPlayer={onOpenPlayer} />
      <TeamTable team={ordered.teams[1]} label={ordered.labels[1]} accent={SERIES.them} myId={myPlayerId} met={byId} onOpenPlayer={onOpenPlayer} />
      {met.data && met.data.coverage.scanned > 0 && (
        <p className="text-[10px] text-fog-500">
          {t('met.legend', { n: met.data.coverage.scanned })}
          {met.data.coverage.complete ? '' : ` ${t('met.partial')}`}
        </p>
      )}
    </div>
  );
}
