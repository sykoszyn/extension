#!/usr/bin/env node
/**
 * End-to-end check of the BUILT Chrome extension in real Chromium.
 *
 *   npm run e2e
 *
 * Builds its own copy (dist-e2e/chrome) with a test proxy URL compiled in, so
 * the public default (no API key, via the SykosTracker proxy) is what gets
 * tested, plus the "own API key → straight to FACEIT" path.
 *
 * Loads dist/chrome, intercepts requests to open.faceit.com with deterministic
 * fixtures (no real key needed), and drives the popup, the internal dashboard
 * page, the in-page FACEIT panels (on a stubbed faceit.com page) and Auto
 * Accept, asserting real rendered values. Screenshots go to
 * $E2E_OUT (default: dist/e2e).
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ME, RIVAL, LIVE_MATCH_ID, MATCHES, handle } from '../tests/fixtures/mock-faceit.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const PROXY = 'https://sykos-proxy.e2e.test';
const built = spawnSync(process.execPath, [path.join(root, 'scripts/build.mjs'), 'chrome'], {
  env: { ...process.env, SYKOS_PROXY_URL: PROXY, SYKOS_DIST: 'dist-e2e' },
  stdio: 'inherit',
});
if (built.status !== 0) process.exit(1);
const ext = path.join(root, 'dist-e2e/chrome');
const out = process.env.E2E_OUT ?? path.join(root, 'dist/e2e');
await mkdir(out, { recursive: true });


const ctx = await chromium.launchPersistentContext('', {
  headless: true,
  // New headless mode (channel 'chromium') is required for extensions.
  channel: 'chromium',
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(['✓', name]);
  } catch (e) {
    results.push(['✗', name, e.message.split('\n')[0]]);
  }
};

// Every FACEIT Data API call (made by the extension's service worker) is answered
// from fixtures — whether it goes to the SykosTracker proxy or straight to FACEIT.
const apiCalls = [];
const answer = (route) => {
  const req = route.request();
  const url = new URL(req.url());
  apiCalls.push({ host: url.host, path: url.pathname, auth: req.headers()['authorization'] });
  const out = handle(url.pathname.replace('/data/v4', ''), Object.fromEntries(url.searchParams));
  return route.fulfill({ status: out.status, contentType: 'application/json', body: JSON.stringify(out.body) });
};
await ctx.route('https://open.faceit.com/data/v4/**', answer);
await ctx.route(`${PROXY}/data/v4/**`, answer);
// Anything else outside FACEIT would be a privacy regression.
const foreign = [];
ctx.on('request', (r) => {
  const u = new URL(r.url());
  if (!['chrome-extension:', 'data:', 'blob:'].includes(u.protocol) && !/(^|\.)faceit\.com$/.test(u.hostname) && u.origin !== PROXY) foreign.push(r.url());
});

try {
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  await sw.evaluate(
    ([me]) =>
      chrome.storage.local.set({
        // Public default: no API key at all, just the linked nickname.
        'sykos.settings': { language: 'es', myNickname: 'Sykos', myPlayerId: me },
      }),
    [ME.id],
  );
  // Close the onboarding tab opened at install.
  for (const p of ctx.pages()) if (p.url().includes('dashboard')) await p.close();
  const page = await ctx.newPage();
  const dash = (h) => page.goto(`chrome-extension://${id}/dashboard/index.html#${h}`);
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`), fullPage: true });

  await step('Overview renders real profile + stats', async () => {
    await dash('overview');
    await page.getByText('Estadísticas CS2').waitFor({ timeout: 15000 });
    await page.getByText('Rendimiento por mapa · lifetime').waitFor();
    assert.ok(await page.getByRole('heading', { name: 'Sykos' }).isVisible());
    await shot('01-overview');
  });

  await step('Player vs Player separates shared/teammate/enemy', async () => {
    await dash(`compare/${RIVAL.id}`);
    await page.getByText('Partidas compartidas').waitFor({ timeout: 20000 });
    const shared = MATCHES.filter((_, i) => i % 4 === 0).length;
    const enemy = MATCHES.filter((_, i) => i % 8 === 0).length;
    const tile = (label) => page.locator('div.rounded-lg', { has: page.locator('.st-label', { hasText: new RegExp(`^${label}`) }) }).locator('.st-num').first().innerText();
    assert.equal(await tile('Partidas compartidas'), String(shared));
    assert.equal(await tile('Como rivales'), String(enemy));
    assert.equal(await tile('Como compañeros'), String(shared - enemy));
    await page.getByText('Historial completo analizado').waitFor();
    await shot('02-pvp');
    // Regression: the suggestion list must float ABOVE the VS card, not behind it.
    const search = page.locator('main input[aria-label="Buscar jugador"]');
    await search.fill('Play');
    const option = page.locator('main [role="listbox"] button').first();
    await option.waitFor({ timeout: 10000 });
    const onTop = await option.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && el.contains(hit);
    });
    assert.ok(onTop, 'search suggestions are hidden behind the stats cards');
    await shot('02b-pvp-search-open');
    await search.press('Escape');
    await option.waitFor({ state: 'detached', timeout: 3000 });
  });

  await step('Match history + expandable scoreboard', async () => {
    await dash('history');
    await page.getByText('Historial de partidas').waitFor();
    await page.locator('tbody tr').first().waitFor({ timeout: 15000 });
    await page.locator('tbody tr').first().click();
    await page.getByText('Duración:').waitFor({ timeout: 10000 });
    assert.ok((await page.getByRole('link', { name: 'VER PARTIDA' }).count()) > 5);
    await shot('03-history');
  });

  await step('Room: 10 players, last 10 maps, "already met" badges, no extra tabs', async () => {
    await dash(`lobby/${LIVE_MATCH_ID}`);
    await page.getByText('Your team').first().waitFor({ timeout: 20000 });
    assert.ok(await page.getByText('Enemy team').first().isVisible());
    assert.equal(await page.locator('main tbody tr').count(), 10);
    // each row: 10 result squares
    assert.equal(await page.locator('main tbody tr').first().locator('[aria-label^="Últimos"] > span').count(), 10);
    // Player123 is a rival in every 8th fixture match → "N× vs" badge
    const rivals = MATCHES.filter((_, i) => i % 8 === 0).length;
    await page.getByText(`${rivals}× vs`).first().waitFor({ timeout: 20000 });
    // the removed analysis tabs must be gone
    for (const t of ['Intel', 'Fuerza', 'Mapas']) assert.equal(await page.getByRole('tab', { name: t }).count(), 0, `${t} tab still shown`);
    await shot('04-lobby');
  });

  await step('Map statistics page', async () => {
    await dash('maps');
    await page.getByText('Map Performance · partidas recientes').waitFor();
    await page.locator('.st-card .st-num').nth(3).waitFor({ timeout: 15000 });
    await shot('07-maps');
  });

  await step('Settings page', async () => {
    await dash('settings');
    await page.getByText('Auto-aceptar partidas').first().waitFor();
    // Advanced options are hidden until asked for.
    assert.equal(await page.getByText('Conexión con FACEIT').count(), 0);
    await shot('08-settings');
  });

  await step('Popup: simple profile card + Auto Accept with inline confirmation', async () => {
    const pop = await ctx.newPage();
    await pop.setViewportSize({ width: 320, height: 600 }); // Chromium caps popups at 600px
    await pop.goto(`chrome-extension://${id}/extension/popup/index.html`);
    await pop.getByText('Ver análisis completo').waitFor();
    await pop.getByText('Cambiar nickname').waitFor({ timeout: 10000 });
    await pop.getByText('ELO', { exact: true }).waitFor();
    const h = await pop.evaluate(() => Math.round(document.getElementById('root').getBoundingClientRect().height));
    assert.ok(h <= 480, `popup should stay compact (${h}px)`);
    const cfg = JSON.parse(await readFile(path.join(root, 'sykos.config.json'), 'utf8'));
    if (cfg.twitter) {
      const tw = pop.locator(`a[href="${cfg.twitter}"]`);
      assert.equal(await tw.count(), 1, 'twitter link from sykos.config.json missing in popup');
      assert.equal(await tw.getAttribute('target'), '_blank');
    }
    await pop.screenshot({ path: path.join(out, '09-popup.png') });
    // Turning Auto Accept on asks once, inline.
    await pop.getByRole('switch', { name: 'Auto-aceptar partidas' }).click();
    await pop.getByRole('button', { name: 'Activar' }).waitFor();
    await pop.screenshot({ path: path.join(out, '09b-popup-confirm.png') });
    await pop.getByRole('button', { name: 'Cancelar' }).click();
    const s = await sw.evaluate(async () => (await chrome.storage.local.get('sykos.settings'))['sykos.settings']);
    assert.equal(s.autoAccept?.enabled ?? false, false, 'cancel must keep Auto Accept off');
    await pop.close();
  });

  await step('Popup: first run asks only for the nickname', async () => {
    const saved = await sw.evaluate(async () => (await chrome.storage.local.get('sykos.settings'))['sykos.settings']);
    await sw.evaluate(async (s) => chrome.storage.local.set({ 'sykos.settings': { ...s, myNickname: '', myPlayerId: '' } }), saved);
    const pop = await ctx.newPage();
    await pop.setViewportSize({ width: 320, height: 600 });
    await pop.goto(`chrome-extension://${id}/extension/popup/index.html`);
    await pop.getByPlaceholder('tu_nickname').fill('Sykos');
    await pop.screenshot({ path: path.join(out, '09c-popup-first-run.png') });
    await pop.getByRole('button', { name: 'Guardar' }).click();
    await pop.getByText('Cambiar nickname').waitFor({ timeout: 10000 });
    const now = await sw.evaluate(async () => (await chrome.storage.local.get('sykos.settings'))['sykos.settings']);
    assert.equal(now.myPlayerId, saved.myPlayerId);
    await pop.close();
  });

  await step('Languages: switching changes the UI (ru, en) and back to es', async () => {
    const setLang = (lang) => sw.evaluate(async (l) => {
      const st = (await chrome.storage.local.get('sykos.settings'))['sykos.settings'];
      await chrome.storage.local.set({ 'sykos.settings': { ...st, language: l } });
    }, lang);
    const pop = await ctx.newPage();
    await pop.setViewportSize({ width: 320, height: 600 });
    for (const [lang, text] of [['ru', 'Полный анализ'], ['en', 'Full analysis'], ['pt', 'Ver análise completa']]) {
      await setLang(lang);
      await pop.goto(`chrome-extension://${id}/extension/popup/index.html`);
      await pop.getByText(text).waitFor({ timeout: 10000 });
      if (lang === 'ru') await pop.screenshot({ path: path.join(out, '09d-popup-ru.png') });
    }
    // live switch without reload: the language picker in the popup
    try {
      await pop.locator('[data-testid="lang-select"]').selectOption('es');
      await pop.getByText('Ver análisis completo').waitFor({ timeout: 10000 });
    } finally {
      await setLang('es'); // the remaining checks are written in Spanish
      await pop.close();
    }
  });

  // ── In-page integration on (stubbed) faceit.com ──
  const stub = (body = '') => `<!doctype html><html><head><title>FACEIT stub</title></head><body style="background:#1f1f1f;color:#fff;font-family:sans-serif;margin:0"><div style="height:64px;background:#141414"></div><main style="padding:24px">${body}</main></body></html>`;
  let stubBody = '<h1>FACEIT (stub)</h1>';
  await ctx.route('https://www.faceit.com/**', (r) => r.fulfill({ contentType: 'text/html', body: stub(stubBody) }));

  await step('Content script: profile panel with VS tab', async () => {
    const fp = await ctx.newPage();
    await fp.goto('https://www.faceit.com/es/players/Player123');
    await fp.getByText('Estadísticas CS2').waitFor({ timeout: 20000 });
    await fp.screenshot({ path: path.join(out, '10-faceit-profile.png') });
    await fp.getByRole('tab', { name: 'VS vos' }).click();
    await fp.getByText('Partidas compartidas').waitFor({ timeout: 20000 });
    await fp.screenshot({ path: path.join(out, '11-faceit-pvp.png') });
    await fp.close();
  });

  await step('Content script: lobby analyzer on room page', async () => {
    const fp = await ctx.newPage();
    await fp.goto(`https://www.faceit.com/en/cs2/room/${LIVE_MATCH_ID}`);
    await fp.getByText('YOUR TEAM').first().waitFor({ timeout: 20000 });
    await fp.screenshot({ path: path.join(out, '12-faceit-room.png') });
    await fp.close();
  });

  await step('Auto Accept OFF: notifies, never clicks', async () => {
    stubBody = `<div role="dialog"><h2>Match found</h2><button id="acc" onclick="window.__accepted=(window.__accepted||0)+1">Accept</button></div>`;
    const fp = await ctx.newPage();
    await fp.goto('https://www.faceit.com/en/matchmaking');
    await fp.getByText('Auto Accept está desactivado').waitFor({ timeout: 10000 });
    await fp.waitForTimeout(1500);
    assert.equal(await fp.evaluate(() => window.__accepted ?? 0), 0);
    await fp.close();
  });

  await step('Auto Accept ON: clicks the official button once, silently (no toast)', async () => {
    await sw.evaluate(async () => {
      const s = (await chrome.storage.local.get('sykos.settings'))['sykos.settings'];
      await chrome.storage.local.set({ 'sykos.settings': { ...s, autoAccept: { enabled: true, acknowledged: true, delaySeconds: 3, notify: true, sound: true } } });
    });
    const fp = await ctx.newPage();
    await fp.goto('https://www.faceit.com/en/matchmaking');
    await fp.waitForFunction(() => (window.__accepted ?? 0) === 1, null, { timeout: 10000 });
    await fp.waitForTimeout(1500);
    assert.equal(await fp.evaluate(() => window.__accepted), 1, 'must click exactly once');
    const toast = await fp.evaluate(() => document.getElementById('sykostracker-root')?.shadowRoot?.querySelector('[role="status"]') ? 1 : 0);
    assert.equal(toast, 0, 'no SykosTracker pop-up when auto-accepting');
    await fp.close();
  });

  await step('Network (no key): everything via the SykosTracker proxy, no key sent, no other hosts', async () => {
    assert.ok(apiCalls.length > 10, `expected API calls, got ${apiCalls.length}`);
    assert.ok(apiCalls.every((c) => c.host === new URL(PROXY).host), 'a call bypassed the proxy');
    assert.ok(apiCalls.every((c) => !c.auth), 'the extension must not send any key to the proxy');
    assert.deepEqual(foreign, []);
  });

  await step('Own API key: goes straight to open.faceit.com with Bearer', async () => {
    apiCalls.length = 0;
    await sw.evaluate(async () => {
      const s = (await chrome.storage.local.get('sykos.settings'))['sykos.settings'];
      await chrome.storage.local.set({ 'sykos.settings': { ...s, faceitApiKey: 'user-own-key' } });
    });
    await dash('settings');
    await page.getByRole('button', { name: 'Opciones avanzadas' }).click();
    await page.getByRole('button', { name: 'Guardar y probar' }).click();
    await page.getByText(/Conexión con FACEIT correcta \(directa con tu API key\)/).waitFor({ timeout: 15000 });
    assert.ok(apiCalls.length >= 1);
    assert.ok(apiCalls.every((c) => c.host === 'open.faceit.com' && c.auth === 'Bearer user-own-key'));
  });
  // Must be the LAST step: it reloads the extension.
  await step('Reloading the extension with a FACEIT tab open: stale panel removed, no errors', async () => {
    const fp = await ctx.newPage();
    const logged = [];
    fp.on('console', (m) => m.type() === 'error' && logged.push(m.text()));
    await fp.goto('https://www.faceit.com/es/players/Player123');
    await fp.getByText('Estadísticas CS2').waitFor({ timeout: 20000 });
    await sw.evaluate(() => setTimeout(() => chrome.runtime.reload(), 50)).catch(() => undefined);
    await fp.waitForFunction(() => !document.getElementById('sykostracker-root'), null, { timeout: 8000 });
    await fp.waitForTimeout(1500);
    assert.deepEqual(logged.filter((t) => /context invalidated/i.test(t)), []);
    await fp.close();
  });
} finally {
  await ctx.close();
}

for (const r of results) console.log(r.join(' '));
const failed = results.filter((r) => r[0] === '✗').length;
console.log(`\n${results.length - failed}/${results.length} e2e checks passed · screenshots: ${path.relative(root, out) || out}`);
process.exit(failed ? 1 : 0);
