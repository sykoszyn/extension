#!/usr/bin/env node
/**
 * Generates Chrome Web Store / Edge / AMO listing images from the REAL built
 * extension running in Chromium (FACEIT API answered with the demo fixtures).
 *
 *   node scripts/store-assets.mjs        → dist/store/*.png
 *
 * Output (exact sizes required by the stores):
 *   screenshot-1..4.png   1280×800
 *   promo-small.png        440×280
 *   promo-marquee.png     1400×560
 *
 * Note: the data shown is demo data (fictional players), as is usual for
 * store screenshots. You can replace them with captures of your own account.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ME, RIVAL, LIVE_MATCH_ID, handle } from '../tests/fixtures/mock-faceit.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const out = process.env.STORE_OUT ?? path.join(root, 'dist/store');
await mkdir(out, { recursive: true });

// REAL mode: STORE_REAL_PROXY=https://<your-worker> STORE_REAL_NICK=<nick> → live FACEIT data.
const REAL = process.env.STORE_REAL_PROXY && process.env.STORE_REAL_NICK ? { proxy: process.env.STORE_REAL_PROXY.replace(/\/+$/, ''), nick: process.env.STORE_REAL_NICK } : null;
const PROXY = REAL ? REAL.proxy : 'https://sykos-proxy.store.test';
const built = spawnSync(process.execPath, [path.join(root, 'scripts/build.mjs'), 'chrome'], {
  env: { ...process.env, SYKOS_PROXY_URL: PROXY, SYKOS_DIST: 'dist-store' },
  stdio: 'inherit',
});
if (built.status !== 0) process.exit(1);
const ext = path.join(root, 'dist-store/chrome');
const logoSvg = await readFile(path.join(root, 'extension/assets/icons/logo.svg'), 'utf8');

const ctx = await chromium.launchPersistentContext('', {
  headless: true,
  channel: 'chromium',
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  // In REAL mode the browser must reach the worker through the environment's HTTPS proxy, if any.
  ...(REAL && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
});
if (!REAL) {
  const answer = (route) => {
    const url = new URL(route.request().url());
    const r = handle(url.pathname.replace('/data/v4', ''), Object.fromEntries(url.searchParams));
    return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
  };
  await ctx.route(`${PROXY}/data/v4/**`, answer);
}
// Neutral stand-in for a faceit.com page (no FACEIT branding is reproduced).
const stub = `<!doctype html><html><body style="margin:0;background:#16171b;font-family:system-ui">
  <div style="height:64px;background:#101114;border-bottom:1px solid #222"></div>
  <div style="padding:32px;display:grid;gap:16px;max-width:760px">
    ${Array.from({ length: 6 }, (_, i) => `<div style="height:${i ? 70 : 140}px;border-radius:8px;background:#1d1f24"></div>`).join('')}
  </div></body></html>`;
await ctx.route('https://www.faceit.com/**', (r) => r.fulfill({ contentType: 'text/html', body: stub }));

let [sw] = ctx.serviceWorkers();
sw ??= await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
// Subjects: demo fixtures, or (REAL) your account, your latest match room and your most frequent co-player.
let subject = { meId: ME.id, meNick: 'Sykos', roomId: LIVE_MATCH_ID, otherNick: RIVAL.nickname };
if (REAL) {
  subject = await sw.evaluate(
    async ({ proxy, nick }) => {
      // Retry politely if the worker's per-IP limit (429) kicks in.
      const get = async (p) => {
        for (let i = 0; i < 8; i++) {
          const r = await fetch(`${proxy}/data/v4${p}`);
          if (r.ok) return r.json();
          await new Promise((ok) => setTimeout(ok, 15000));
        }
        throw new Error(`proxy kept failing for ${p}`);
      };
      const me = await get(`/players?nickname=${encodeURIComponent(nick)}&game=cs2`);
      const hist = await get(`/players/${me.player_id}/history?game=cs2&limit=100&from=1672531200`);
      const counts = {};
      for (const m of hist.items ?? [])
        for (const f of ['faction1', 'faction2'])
          for (const p of m.teams[f].players) if (p.player_id !== me.player_id) counts[p.nickname] = (counts[p.nickname] ?? 0) + 1;
      const otherNick = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      return { meId: me.player_id, meNick: me.nickname, roomId: hist.items[0].match_id, otherNick };
    },
    { proxy: REAL.proxy, nick: REAL.nick },
  );
  console.log(`› real data: ${subject.meNick} · room ${subject.roomId} · vs ${subject.otherNick}`);
}
await sw.evaluate(([id, nick]) => chrome.storage.local.set({ 'sykos.settings': { myNickname: nick, myPlayerId: id } }), [subject.meId, subject.meNick]);
for (const p of ctx.pages()) if (p.url().includes('dashboard')) await p.close();

const settle = (p, ms = 1800) => p.waitForTimeout(ms); // let rise/chart animations finish
const raw = {};
const grab = async (name, locator) => (raw[name] = (await locator.screenshot({ animations: 'disabled' })).toString('base64'));

// ── raw captures ─────────────────────────────────────────────────────────────
{
  const p = await ctx.newPage();
  await p.goto(`https://www.faceit.com/en/cs2/room/${subject.roomId}`);
  await p.getByText('Your team').first().waitFor({ timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('sykostracker-root')?.shadowRoot?.querySelector('.animate-spin'), null, { timeout: 60000 }).catch(() => undefined);
  await settle(p);
  await grab('room', p.locator('aside[aria-label="SykosTracker"]'));
  await p.locator('aside[aria-label="SykosTracker"]').screenshot({ path: path.join(out, 'panel-sala.png'), animations: 'disabled' });
  await p.close();
}
{
  const p = await ctx.newPage();
  await p.goto(`https://www.faceit.com/en/players/${encodeURIComponent(subject.otherNick)}`);
  await p.getByRole('tab', { name: 'VS tú' }).click({ timeout: 60000 });
  await p.getByText('Partidas compartidas').waitFor({ timeout: 90000 });
  await settle(p, 2500);
  await grab('pvp', p.locator('aside[aria-label="SykosTracker"]'));
  await p.locator('aside[aria-label="SykosTracker"]').screenshot({ path: path.join(out, 'panel-vs.png'), animations: 'disabled' });
  await p.close();
}
{
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto(`chrome-extension://${id}/dashboard/index.html#overview`);
  await p.getByText('Rendimiento por mapa · lifetime').waitFor({ timeout: 60000 });
  await p.addStyleTag({ content: 'header.sticky{display:none!important}' });
  await p.evaluate(() => scrollTo(0, 0));
  await settle(p, 2200);
  await grab('overview', p.locator('main'));
  await p.close();
}
{
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 320, height: 600 });
  await p.goto(`chrome-extension://${id}/extension/popup/index.html`);
  await p.getByText('Cambiar nickname').waitFor({ timeout: 30000 });
  await settle(p);
  await grab('popup', p.locator('#root'));
  await p.locator('#root').screenshot({ path: path.join(out, 'panel-popup.png'), animations: 'disabled' });
  await p.close();
}

// ── compose listing images ───────────────────────────────────────────────────
const css = `
  *{box-sizing:border-box;margin:0}
  body{width:var(--w);height:var(--h);overflow:hidden;background:#07080a;color:#f2f3f5;
    font-family:"Inter","Segoe UI",system-ui,sans-serif;position:relative}
  .bg{position:absolute;inset:0;background:
    radial-gradient(70% 90% at 0% 0%,rgba(255,106,31,.22),transparent 60%),
    radial-gradient(60% 80% at 100% 100%,rgba(239,51,70,.14),transparent 60%)}
  .hatch{position:absolute;inset:0;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.022) 0 1px,transparent 1px 10px)}
  .brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:20px}
  .brand b{color:#ff6a1f}
  h1{font-family:"Barlow Condensed","Bahnschrift","Arial Narrow",sans-serif;font-weight:800;text-transform:uppercase;line-height:.95;letter-spacing:.01em}
  h1 em{font-style:normal;color:#ff6a1f}
  p.sub{color:#9aa0ac;line-height:1.4}
  .shot{border-radius:16px;border:1px solid rgba(255,255,255,.1);box-shadow:0 30px 80px -20px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.5);display:block}
`;
const brand = (size = 30) => `<div class="brand">${logoSvg.replace('<svg ', `<svg width="${size}" height="${size}" `)}<span>Sykos<b>Tracker</b></span></div>`;
const img = (k, style) => `<img class="shot" style="${style}" src="data:image/png;base64,${raw[k]}">`;

const slides = [
  {
    name: 'screenshot-1',
    html: `<div style="position:absolute;left:64px;top:64px">${brand()}</div>
      <div style="position:absolute;left:64px;top:210px;width:400px">
        <h1 style="font-size:70px">Tu sala,<br><em>de un vistazo</em></h1>
        <p class="sub" style="font-size:22px;margin-top:22px">Los 10 jugadores con sus <b style="color:#f2f3f5">últimos 10 mapas</b>: WR, K/D, ADR y HS%. Y te avisa si ya jugaste <b style="color:#f2f3f5">contra</b> o <b style="color:#f2f3f5">con</b> alguno.</p>
      </div>
      ${img('room', 'position:absolute;right:48px;top:40px;height:720px;width:auto;object-fit:cover;object-position:top')}`,
  },
  {
    name: 'screenshot-2',
    html: `<div style="position:absolute;left:72px;top:64px">${brand()}</div>
      <div style="position:absolute;left:72px;top:220px;width:520px">
        <h1 style="font-size:78px">Player<br><em>vs</em> Player</h1>
        <p class="sub" style="font-size:24px;margin-top:22px">Cuántas veces jugaste <b style="color:#f2f3f5">con</b> o <b style="color:#f2f3f5">contra</b> cualquier jugador, tu récord en enfrentamientos directos y el historial completo.</p>
      </div>
      ${img('pvp', 'position:absolute;right:72px;top:48px;height:704px;width:auto;object-fit:cover;object-position:top')}`,
  },
  {
    name: 'screenshot-3',
    html: `<div style="position:absolute;left:96px;top:64px">${brand()}</div>
      <div style="position:absolute;left:96px;top:250px;width:560px">
        <h1 style="font-size:80px">Solo tu <em>nick</em></h1>
        <p class="sub" style="font-size:24px;margin-top:22px">Sin registro ni contraseñas. Tu ELO, lo que te falta para el siguiente nivel y cómo vas hoy. Auto-aceptar partidas opcional.</p>
      </div>
      ${img('popup', 'position:absolute;right:150px;top:90px;width:400px;height:auto')}`,
  },
  {
    name: 'screenshot-4',
    html: `<div style="position:absolute;left:64px;top:56px">${brand()}</div>
      <div style="position:absolute;left:64px;top:120px;width:1152px">
        <h1 style="font-size:64px">Tu perfil, <em>a fondo</em></h1>
        <p class="sub" style="font-size:22px;margin-top:10px">Win rate, K/D, ADR, HS%, rachas, últimas 20 partidas y rendimiento por mapa.</p>
      </div>
      ${img('overview', 'position:absolute;left:64px;top:292px;width:1152px;height:470px;object-fit:cover;object-position:top')}`,
  },
];

const page = await ctx.newPage();
const render = async (name, w, h, body) => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body style="--w:${w}px;--h:${h}px"><div class="bg"></div><div class="hatch"></div>${body}</body></html>`);
  await page.waitForLoadState('load');
  // deviceScaleFactor is 2 on this context; scale:'css' gives exact CSS-pixel output.
  await page.screenshot({ path: path.join(out, `${name}.png`), scale: 'css' });
  console.log(`✓ ${name}.png ${w}×${h}`);
};

for (const s of slides) await render(s.name, 1280, 800, s.html);

await render(
  'promo-small',
  440,
  280,
  `<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 36px">
     ${brand(34)}
     <h1 style="font-size:38px;margin-top:18px">Stats de CS2<br>en <em>FACEIT</em></h1>
     <p class="sub" style="font-size:14px;margin-top:10px">Player vs Player · Lobby Analyzer · Mapas</p>
   </div>`,
);

await render(
  'promo-marquee',
  1400,
  560,
  `<div style="position:absolute;left:90px;top:0;bottom:0;width:620px;display:flex;flex-direction:column;justify-content:center">
     ${brand(40)}
     <h1 style="font-size:64px;margin-top:24px">Gana info <em>antes</em><br>de cada partida</h1>
     <p class="sub" style="font-size:22px;margin-top:18px">Player vs Player, Lobby Analyzer y Enemy Intelligence para CS2 en FACEIT. Solo con tu nick.</p>
   </div>
   ${img('room', 'position:absolute;right:-40px;top:60px;width:700px;height:440px;object-fit:cover;object-position:top left')}`,
);

await ctx.close();
console.log(`\nListo: ${path.relative(root, out) || out}`);
