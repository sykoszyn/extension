/**
 * TEST-ONLY deterministic mock of the FACEIT Data API v4 shapes used by
 * SykosTracker. Never bundled into the extension. Used by unit tests and by
 * the end-to-end browser check (scripts/e2e.mjs) to exercise the real UI
 * without network access to open.faceit.com.
 */

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const MAPS = ['de_mirage', 'de_inferno', 'de_nuke', 'de_ancient', 'de_anubis', 'de_dust2', 'de_train'];
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const ME = { id: uuid(1), nickname: 'Sykos' };
export const RIVAL = { id: uuid(2), nickname: 'Player123' };

const NAMES = ['Sykos', 'Player123', 'zNova', 'krypt0', 'mAx1', 'Hydra', 'ripz', 'Lumen', 'vex', 'B0lt', 'Ghosty', 'nerf', 'ozzy', 'Tanker', 'Kairo', 'yeti'];
export const PLAYERS = NAMES.map((nickname, i) => ({ id: uuid(i + 1), nickname, elo: 1400 + ((i * 137) % 1500), level: Math.min(10, 4 + (i % 7)) }));
const byId = new Map(PLAYERS.map((p) => [p.id, p]));
const byNick = new Map(PLAYERS.map((p) => [p.nickname.toLowerCase(), p]));

const NOW = Date.UTC(2026, 10, 1) / 1000;

/** 260 matches for "me". Rival appears in ~1/4 of them, alternating sides. */
function buildMatches() {
  const r = rng(42);
  const out = [];
  for (let i = 0; i < 260; i++) {
    const started = NOW - i * 3600 * 9 - Math.floor(r() * 3000);
    const pool = PLAYERS.slice(2).sort(() => r() - 0.5);
    const mine = [ME.id];
    const theirs = [];
    const rivalIn = i % 4 === 0;
    const rivalEnemy = i % 8 === 0;
    if (rivalIn) (rivalEnemy ? theirs : mine).push(RIVAL.id);
    while (mine.length < 5) mine.push(pool.pop().id);
    while (theirs.length < 5) theirs.push(pool.pop().id);
    const meFaction = i % 3 === 0 ? 'faction2' : 'faction1';
    const winner = r() < 0.55 ? meFaction : meFaction === 'faction1' ? 'faction2' : 'faction1';
    const map = MAPS[Math.floor(r() * MAPS.length)];
    const wr = 13;
    const lr = Math.floor(r() * 12);
    out.push({
      id: `1-${uuid(1000 + i)}`,
      started,
      finished: started + 2400 + Math.floor(r() * 900),
      teams: meFaction === 'faction1' ? { faction1: mine, faction2: theirs } : { faction1: theirs, faction2: mine },
      winner,
      map,
      score: winner === meFaction ? `${wr} / ${lr}` : `${lr} / ${wr}`,
      rounds: wr + lr,
      stat: Object.fromEntries([...mine, ...theirs].map((pid) => {
        const k = 8 + Math.floor(r() * 22);
        const d = 8 + Math.floor(r() * 20);
        return [pid, { k, d, a: Math.floor(r() * 9), adr: 55 + Math.round(r() * 600) / 10, hs: 25 + Math.floor(r() * 45), mvps: Math.floor(r() * 5) }];
      })),
    });
  }
  return out;
}
export const MATCHES = buildMatches();

const rosterPlayer = (id) => {
  const p = byId.get(id);
  return { player_id: id, nickname: p.nickname, avatar: '', skill_level: p.level, game_player_name: p.nickname, faceit_url: `https://www.faceit.com/{lang}/players/${p.nickname}` };
};

function playerJson(p) {
  return {
    player_id: p.id,
    nickname: p.nickname,
    avatar: '',
    country: 'es',
    faceit_url: `https://www.faceit.com/{lang}/players/${p.nickname}`,
    games: { cs2: { region: 'EU', skill_level: p.level, faceit_elo: p.elo, game_player_name: p.nickname } },
  };
}

function matchesOf(pid) {
  return MATCHES.filter((m) => m.teams.faction1.includes(pid) || m.teams.faction2.includes(pid));
}

function historyItem(m) {
  return {
    match_id: m.id,
    game_id: 'cs2',
    region: 'EU',
    game_mode: '5v5',
    competition_name: '5v5 RANKED',
    status: 'finished',
    started_at: m.started,
    finished_at: m.finished,
    results: { winner: m.winner, score: { faction1: m.winner === 'faction1' ? 1 : 0, faction2: m.winner === 'faction2' ? 1 : 0 } },
    faceit_url: `https://www.faceit.com/{lang}/cs2/room/${m.id}`,
    teams: {
      faction1: { nickname: `team_${byId.get(m.teams.faction1[0]).nickname}`, players: m.teams.faction1.map(rosterPlayer) },
      faction2: { nickname: `team_${byId.get(m.teams.faction2[0]).nickname}`, players: m.teams.faction2.map(rosterPlayer) },
    },
  };
}

function statLine(m, pid) {
  const s = m.stat[pid];
  const fac = m.teams.faction1.includes(pid) ? 'faction1' : 'faction2';
  return {
    stats: {
      'Match Id': m.id,
      Map: m.map,
      Result: m.winner === fac ? '1' : '0',
      Kills: String(s.k),
      Deaths: String(s.d),
      Assists: String(s.a),
      'K/D Ratio': (s.k / s.d).toFixed(2),
      'K/R Ratio': (s.k / m.rounds).toFixed(2),
      ADR: String(s.adr),
      'Headshots %': String(s.hs),
      MVPs: String(s.mvps),
      Score: m.score,
      Rounds: String(m.rounds),
      'Match Finished At': m.finished * 1000,
    },
  };
}

function lifetime(pid) {
  const ms = matchesOf(pid);
  const wins = ms.filter((m) => (m.teams.faction1.includes(pid) ? 'faction1' : 'faction2') === m.winner).length;
  const segs = MAPS.map((map) => {
    const mm = ms.filter((m) => m.map === map);
    const w = mm.filter((m) => (m.teams.faction1.includes(pid) ? 'faction1' : 'faction2') === m.winner).length;
    return { type: 'Map', mode: '5v5', label: map, stats: { Matches: String(mm.length), Wins: String(w), 'Win Rate %': mm.length ? String(Math.round((w / mm.length) * 100)) : '0', 'Average K/D Ratio': '1.05', ADR: '78.4', 'Average Headshots %': '47' } };
  }).filter((s) => s.stats.Matches !== '0');
  return {
    player_id: pid,
    game_id: 'cs2',
    lifetime: {
      Matches: String(ms.length * 4),
      Wins: String(wins * 4),
      'Win Rate %': ms.length ? String(Math.round((wins / ms.length) * 100)) : '0',
      'Average K/D Ratio': '1.08',
      'Average Headshots %': '48',
      ADR: '80.2',
      'Longest Win Streak': '9',
      'Current Win Streak': '2',
      'Recent Results': ['1', '0', '1', '1', '0'],
    },
    segments: segs,
  };
}

/** The live lobby used by the e2e check (veto finished, map picked). */
export const LIVE_MATCH_ID = `1-${uuid(9999)}`;
const LIVE_TEAMS = { faction1: [ME.id, uuid(3), uuid(4), uuid(5), uuid(6)], faction2: [RIVAL.id, uuid(7), uuid(8), uuid(9), uuid(10)] };

/**
 * Returns { status, body } for a Data API path + query.
 * @param {string} path
 * @param {Record<string, any>} [query]
 * @returns {{ status: number, body: any }}
 */
export function handle(path, query = {}) {
  let m;
  if (path === '/players') {
    const p = byNick.get(String(query.nickname ?? '').toLowerCase());
    return p ? { status: 200, body: playerJson(p) } : { status: 404, body: { errors: [{ message: 'not found' }] } };
  }
  if (path === '/search/players') {
    const q = String(query.nickname ?? '').toLowerCase();
    return { status: 200, body: { items: PLAYERS.filter((p) => p.nickname.toLowerCase().includes(q)).map((p) => ({ player_id: p.id, nickname: p.nickname, avatar: '', country: 'es', games: [{ name: 'cs2', skill_level: String(p.level) }] })) } };
  }
  if ((m = /^\/players\/([\w-]+)$/.exec(path))) {
    const p = byId.get(m[1]);
    return p ? { status: 200, body: playerJson(p) } : { status: 404, body: {} };
  }
  if ((m = /^\/players\/([\w-]+)\/stats\/cs2$/.exec(path))) return { status: 200, body: lifetime(m[1]) };
  if ((m = /^\/players\/([\w-]+)\/games\/cs2\/stats$/.exec(path))) {
    const off = Number(query.offset ?? 0);
    const lim = Math.min(100, Number(query.limit ?? 20));
    return { status: 200, body: { items: matchesOf(m[1]).slice(off, off + lim).map((x) => statLine(x, m[1])) } };
  }
  if ((m = /^\/players\/([\w-]+)\/history$/.exec(path))) {
    const from = Number(query.from ?? NOW - 30 * 86400);
    const to = query.to !== undefined ? Number(query.to) : Infinity;
    const off = Number(query.offset ?? 0);
    const lim = Math.min(100, Number(query.limit ?? 20));
    const list = matchesOf(m[1]).filter((x) => x.started >= from && x.started <= to);
    return { status: 200, body: { items: list.slice(off, off + lim).map(historyItem) } };
  }
  if ((m = /^\/matches\/([\w-]+)\/stats$/.exec(path))) {
    const x = MATCHES.find((y) => y.id === m[1]);
    if (!x) return { status: 404, body: {} };
    return {
      status: 200,
      body: {
        rounds: [
          {
            round_stats: { Map: x.map, Score: x.score, Rounds: String(x.rounds) },
            teams: ['faction1', 'faction2'].map((f) => ({
              team_id: `${x.id}-${f}`,
              team_stats: { Team: `team_${f}`, 'Final Score': f === x.winner ? '13' : x.score.split(' / ').sort()[0], 'Team Win': f === x.winner ? '1' : '0' },
              players: x.teams[f].map((pid) => {
                const s = x.stat[pid];
                return { player_id: pid, nickname: byId.get(pid).nickname, player_stats: { Kills: String(s.k), Deaths: String(s.d), Assists: String(s.a), 'K/D Ratio': (s.k / s.d).toFixed(2), ADR: String(s.adr), 'Headshots %': String(s.hs), MVPs: String(s.mvps) } };
              }),
            })),
          },
        ],
      },
    };
  }
  if ((m = /^\/matches\/([\w-]+)$/.exec(path))) {
    const roster = (ids) => ids.map((id) => ({ player_id: id, nickname: byId.get(id).nickname, avatar: '', game_skill_level: byId.get(id).level }));
    if (m[1] === LIVE_MATCH_ID) {
      return {
        status: 200,
        body: {
          match_id: LIVE_MATCH_ID,
          status: 'READY',
          region: 'EU',
          competition_name: '5v5 RANKED',
          configured_at: NOW,
          faceit_url: `https://www.faceit.com/{lang}/cs2/room/${LIVE_MATCH_ID}`,
          voting: { map: { entities: MAPS.map((x) => ({ guid: x, class_name: x, name: x })), pick: ['de_mirage'] } },
          teams: { faction1: { name: 'team_Sykos', roster: roster(LIVE_TEAMS.faction1) }, faction2: { name: 'team_Player123', roster: roster(LIVE_TEAMS.faction2) } },
        },
      };
    }
    const x = MATCHES.find((y) => y.id === m[1]);
    if (!x) return { status: 404, body: {} };
    return {
      status: 200,
      body: {
        match_id: x.id,
        status: 'FINISHED',
        started_at: x.started,
        finished_at: x.finished,
        region: 'EU',
        faceit_url: `https://www.faceit.com/{lang}/cs2/room/${x.id}`,
        results: { winner: x.winner, score: { faction1: x.winner === 'faction1' ? 1 : 0, faction2: x.winner === 'faction2' ? 1 : 0 } },
        voting: { map: { pick: [x.map] } },
        teams: { faction1: { name: 'Team A', roster: roster(x.teams.faction1) }, faction2: { name: 'Team B', roster: roster(x.teams.faction2) } },
      },
    };
  }
  return { status: 404, body: { errors: [{ message: `mock: unknown path ${path}` }] } };
}
