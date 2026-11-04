/**
 * SykosTracker Performance Index (SPI) — a transparent, home-made team metric.
 *
 * It is NOT a win probability and is never presented as one. It summarises
 * how strong a team's *recorded* numbers look, on a 0–100 scale.
 *
 *   SPI = Σ wᵢ·sᵢ / Σ wᵢ   over components i that have data
 *
 *   component         raw value (team mean)                 normalisation sᵢ (clamped 0–100)    wᵢ
 *   ELO               current FACEIT ELO                    (elo − 500) / 2500 · 100            0.30
 *   K/D               Σkills/Σdeaths, last 20 matches       (kd − 0.6) / 1.0 · 100              0.20
 *   ADR               mean ADR, last 20 matches             (adr − 50) / 60 · 100               0.15
 *   Recent WR         win % over last 20 matches            wr                                  0.15
 *   Map WR            lifetime win % on the picked map      wr                                  0.10
 *   Experience        lifetime matches                      log10(m) / log10(3000) · 100        0.10
 *
 * Missing components are dropped and the remaining weights re-normalised; the
 * UI lists which components were available.
 */
import type { LobbyPlayer, LobbyTeam, StrengthComponent, TeamStrength } from '../types/analytics';
import { formSummary } from './analytics';

export const SPI_WEIGHTS = {
  elo: 0.3,
  kd: 0.2,
  adr: 0.15,
  recentWr: 0.15,
  mapWr: 0.1,
  experience: 0.1,
} as const;

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export const NORMALISERS: Record<StrengthComponent['key'], (raw: number) => number> = {
  elo: (v) => clamp(((v - 500) / 2500) * 100),
  kd: (v) => clamp(((v - 0.6) / 1.0) * 100),
  adr: (v) => clamp(((v - 50) / 60) * 100),
  recentWr: (v) => clamp(v),
  mapWr: (v) => clamp(v),
  experience: (v) => (v <= 1 ? 0 : clamp((Math.log10(v) / Math.log10(3000)) * 100)),
};

const LABELS: Record<StrengthComponent['key'], string> = {
  elo: 'ELO',
  kd: 'K/D (últ. 20)',
  adr: 'ADR (últ. 20)',
  recentWr: 'Win rate (últ. 20)',
  mapWr: 'Win rate en el mapa',
  experience: 'Experiencia',
};

export function playerMapWinRate(p: LobbyPlayer, map: string | null): number | null {
  if (!map || !p.lifetime) return null;
  const seg = p.lifetime.maps.find((m) => m.map === map);
  if (!seg || seg.matches === 0) return null;
  return seg.winRate ?? (seg.wins / seg.matches) * 100;
}

export function teamStrength(team: LobbyTeam, map: string | null): TeamStrength {
  const players = team.players;
  const recent = players.map((p) => (p.recent.length ? formSummary(p.recent.slice(0, 20)) : null));
  const raw: Record<StrengthComponent['key'], number | null> = {
    elo: mean(players.map((p) => p.profile?.elo ?? null)),
    kd: mean(recent.map((r) => r?.kd ?? null)),
    adr: mean(recent.map((r) => r?.adr ?? null)),
    recentWr: mean(recent.map((r) => r?.winRate ?? null)),
    mapWr: mean(players.map((p) => playerMapWinRate(p, map))),
    experience: mean(players.map((p) => p.lifetime?.matches ?? null)),
  };
  const components: StrengthComponent[] = (Object.keys(SPI_WEIGHTS) as StrengthComponent['key'][]).map((key) => ({
    key,
    label: LABELS[key],
    weight: SPI_WEIGHTS[key],
    raw: raw[key],
    score: raw[key] === null ? null : Math.round(NORMALISERS[key](raw[key]!) * 10) / 10,
  }));
  const usable = components.filter((c) => c.score !== null);
  const wsum = usable.reduce((a, c) => a + c.weight, 0);
  const index = wsum > 0 ? Math.round((usable.reduce((a, c) => a + c.weight * c.score!, 0) / wsum) * 10) / 10 : null;
  const totalMatches = players.reduce<number | null>((acc, p) => {
    const m = p.lifetime?.matches;
    return m == null ? acc : (acc ?? 0) + m;
  }, null);

  return {
    faction: team.faction,
    index,
    components,
    avgElo: raw.elo === null ? null : Math.round(raw.elo),
    avgLifetimeWinRate: mean(players.map((p) => p.lifetime?.winRate ?? null)),
    avgRecentKd: raw.kd === null ? null : Math.round(raw.kd * 100) / 100,
    avgRecentAdr: raw.adr === null ? null : Math.round(raw.adr * 10) / 10,
    avgRecentWinRate: raw.recentWr === null ? null : Math.round(raw.recentWr * 10) / 10,
    avgMapWinRate: raw.mapWr === null ? null : Math.round(raw.mapWr * 10) / 10,
    totalMatches,
    coverage: players.filter((p) => p.profile || p.lifetime || p.recent.length).length,
  };
}

/** Strengths/weaknesses: components where one team leads by a clear margin. */
export function compareTeams(a: TeamStrength, b: TeamStrength, margin = 5) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  for (const ca of a.components) {
    const cb = b.components.find((c) => c.key === ca.key);
    if (ca.score === null || cb?.score == null) continue;
    if (ca.score - cb.score >= margin) strengths.push(ca.label);
    else if (cb.score - ca.score >= margin) weaknesses.push(ca.label);
  }
  return { strengths, weaknesses };
}
