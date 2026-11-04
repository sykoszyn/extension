#!/usr/bin/env node
/**
 * Generates Chrome Web Store / Edge / AMO listing images from the REAL built
 * extension running in Chromium (FACEIT API answered with the demo fixtures).
 *
 *   node scripts/store-assets.mjs        → dist/store/*.png
 *
 * Output (exact sizes required by the stores):
 *   screenshot-1..5.png   1280×800
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

const PROXY = 'https://sykos-proxy.store.test';
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
});
const answer = (route) => {
  const url = new URL(route.request().url());
  const r = handle(url.pathname.replace('/data/v4', ''), Object.fromEntries(url.searchParams));
  return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
};
await ctx.route(`${PROXY}/data/v4/**`, answer);
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
await sw.evaluate(([me]) => chrome.storage.local.set({ 'sykos.settings': { myNickname: 'Sykos', myPlayerId: me } }), [ME.id]);
for (const p of ctx.pages()) if (p.url().includes('dashboard')) await p.close();

const settle = (p, ms = 1800) => p.waitForTimeout(ms); // let rise/chart animations finish
const raw = {};
const grab = async (name, locator) => (raw[name] = (await locator.screenshot({ animations: 'disabled' })).toString('base64'));

// ── raw captures ─────────────────────────────────────────────────────────────
{
  const p = await ctx.newPage();
  await p.goto(`https://www.faceit.com/en/cs2/room/${LIVE_MATCH_ID}`);
  await p.getByText('YOUR TEAM').first().waitFor({ timeout: 30000 });
  await settle(p);
  await grab('room', p.locator('aside[aria-label="SykosTracker"]'));
  await p.close();
}
{
  const p = await ctx.newPage();
  await p.goto('https://www.faceit.com/en/players/Player123');
  await p.getByRole('tab', { name: 'VS tú' }).click({ timeout: 30000 });
  await p.getByText('Partidas compartidas').waitFor({ timeout: 30000 });
  await settle(p);
  await grab('pvp', p.locator('aside[aria-label="SykosTracker"]'));
  await p.close();
}
{
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto(`chrome-extension://${id}/dashboard/index.html#lobby/${LIVE_MATCH_ID}`);
  await p.getByRole('tab', { name: 'Intel' }).click({ timeout: 30000 });
  await p.getByText('Posibles premades').waitFor({ timeout: 30000 });
  await p.evaluate(() => {
    // Start the capture at the analysis header (skip the URL input card).
    const h = [...document.querySelectorAll('section')].find((s) => s.textContent?.includes('Lobby Analyzer'));
    h?.remove();
  });
  await p.addStyleTag({ content: 'header.sticky{display:none!important}' }); // sticky bar would overlap the capture
  await p.evaluate(() => scrollTo(0, 0));
  await settle(p);
  await grab('intel', p.locator('main'));
  await p.goto(`chrome-extension://${id}/dashboard/index.html#overview`);
  await p.getByText('Rendimiento por mapa · lifetime').waitFor({ timeout: 30000 });
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
    html: `<div style="position:absolute;left:64px;top:56px">${brand()}</div>
      <div style="position:absolute;left:64px;top:120px;width:1152px">
        <h1 style="font-size:64px">Analiza tu sala <em>antes de jugar</em></h1>
        <p class="sub" style="font-size:22px;margin-top:10px">Los 10 jugadores: ELO, K/D, ADR, forma, rachas y mapas. YOUR TEAM vs ENEMY TEAM.</p>
      </div>
      ${img('room', 'position:absolute;left:64px;top:292px;width:1152px;height:auto;object-fit:cover;object-position:top;max-height:470px')}`,
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
    html: `<div style="position:absolute;left:64px;top:56px">${brand()}</div>
      <div style="position:absolute;left:64px;top:120px;width:1152px">
        <h1 style="font-size:64px">Enemy <em>Intelligence</em></h1>
        <p class="sub" style="font-size:22px;margin-top:10px">Tus duelos previos con cada rival, sus mejores y peores mapas, posibles premades y ayuda para el veto.</p>
      </div>
      ${img('intel', 'position:absolute;left:64px;top:292px;width:1152px;height:470px;object-fit:cover;object-position:top')}`,
  },
  {
    name: 'screenshot-4',
    html: `<div style="position:absolute;left:96px;top:64px">${brand()}</div>
      <div style="position:absolute;left:96px;top:250px;width:560px">
        <h1 style="font-size:80px">Solo tu <em>nick</em></h1>
        <p class="sub" style="font-size:24px;margin-top:22px">Sin registro ni contraseñas. Escribe tu nickname de FACEIT y listo. Auto-aceptar partidas opcional.</p>
      </div>
      ${img('popup', 'position:absolute;right:150px;top:110px;width:400px;height:auto')}`,
  },
  {
    name: 'screenshot-5',
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
