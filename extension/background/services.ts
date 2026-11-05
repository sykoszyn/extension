/**
 * Higher-level background services built on FaceitClient:
 *  - Player vs Player analysis (progressive history scan + per-match stats)
 *  - Lobby analysis (10 players: profile + lifetime + last 20 matches)
 */
import type { LobbyPlayer, LobbyTeam, PvpResult } from '@shared/types/analytics';
import type { Faction, MatchStats } from '@shared/types/faceit';
import type { Settings } from '@shared/types/settings';
import { computePvp, findSharedMatches } from '@shared/utils/analytics';
import { encountersFor } from '@shared/utils/encounters';
import { idb, peekCached } from './db';
import type { FaceitClient } from './faceit-client';
import { coverageOf, EMPTY_HISTORY, scanHistory, type StoredHistory } from './history-scan';

const scanLocks = new Map<string, Promise<StoredHistory>>();

export async function scanPlayerHistory(client: FaceitClient, playerId: string, settings: Settings, older: boolean) {
  const running = scanLocks.get(playerId);
  if (running) return running;
  const job = (async () => {
    const stored = (await idb.get<StoredHistory>('history', playerId).catch(() => undefined)) ?? EMPTY_HISTORY;
    const stale = !stored.updatedAt || Date.now() - stored.updatedAt > 5 * 60_000;
    const next = await scanHistory(stored, (o) => client.historyPage(playerId, o), {
      maxPages: Math.max(1, Math.min(50, settings.pvpPagesPerScan)),
      older,
      refreshNewer: stale,
    });
    await idb.put('history', playerId, next);
    return next;
  })().finally(() => scanLocks.delete(playerId));
  scanLocks.set(playerId, job);
  return job;
}

export async function analyzePvp(
  client: FaceitClient,
  settings: Settings,
  p: { meId: string; otherId: string; since?: number; scanOlder?: boolean; loadStats?: boolean },
): Promise<PvpResult> {
  if (p.meId === p.otherId) throw new Error('No puedes compararte contigo mismo.');
  const history = await scanPlayerHistory(client, p.meId, settings, !!p.scanOlder);
  const shared = findSharedMatches(history.matches, p.meId, p.otherId).sort((a, b) => b.match.startedAt - a.match.startedAt);

  const statsById: Record<string, MatchStats | undefined> = {};
  let budget = p.loadStats === false ? 0 : Math.max(0, settings.pvpStatsPerScan);
  const toFetch: string[] = [];
  for (const s of shared) {
    const id = s.match.matchId;
    const hit = await peekCached<MatchStats | null>(`mstats:${id}`);
    if (hit) statsById[id] = hit;
    else if (hit === undefined && budget > 0 && s.match.status === 'finished') {
      toFetch.push(id);
      budget--;
    }
  }
  const fetched = await Promise.allSettled(toFetch.map((id) => client.matchStats(id)));
  fetched.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) statsById[toFetch[i]] = r.value;
  });

  return computePvp({
    meId: p.meId,
    otherId: p.otherId,
    history: history.matches,
    coverage: coverageOf(history),
    statsById,
    since: p.since,
  });
}

export async function analyzeLobby(client: FaceitClient, matchId: string, force = false) {
  const match = await client.match(matchId, force);
  const factions: Faction[] = ['faction1', 'faction2'];
  const teams: LobbyTeam[] = await Promise.all(
    factions.map(async (f) => ({
      faction: f,
      name: match.teams[f].name,
      players: await Promise.all(
        match.teams[f].players.map(async (rp): Promise<LobbyPlayer> => {
          const [profile, lifetime, recent] = await Promise.allSettled([
            client.resolvePlayer(rp.id),
            client.lifetime(rp.id),
            client.recentStats(rp.id, 20),
          ]);
          const firstErr = [profile, lifetime, recent].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
          return {
            rosterId: rp.id,
            rosterNickname: rp.nickname,
            rosterAvatar: rp.avatar,
            rosterLevel: rp.level,
            profile: profile.status === 'fulfilled' ? profile.value : null,
            lifetime: lifetime.status === 'fulfilled' ? lifetime.value : null,
            recent: recent.status === 'fulfilled' ? recent.value : [],
            error: firstErr ? String(firstErr.reason?.message ?? firstErr.reason) : null,
          };
        }),
      ),
    })),
  );
  return { match, teams };
}

/**
 * Past encounters with each player of a lobby, from the user's locally stored
 * history (scanned incrementally; no extra requests per player).
 */
export async function lobbyEncounters(client: FaceitClient, settings: Settings, matchId: string) {
  const meId = settings.myPlayerId;
  const match = await client.match(matchId);
  const ids = [...match.teams.faction1.players, ...match.teams.faction2.players].map((p) => p.id);
  if (!meId) return { byId: {}, coverage: coverageOf(EMPTY_HISTORY) };
  const history = await scanPlayerHistory(client, meId, settings, false);
  // Ignore the room itself (it is in the history once finished).
  const past = history.matches.filter((m) => m.matchId !== matchId);
  return { byId: encountersFor(past, meId, ids), coverage: coverageOf(history) };
}
