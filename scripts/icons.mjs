#!/usr/bin/env node
/** Renders the SykosTracker logo SVG to PNG icons (16/32/48/128) with the bundled Chromium. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = path.join(root, 'extension/assets/icons');

export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a4c"/><stop offset="1" stop-color="#ef3346"/></linearGradient></defs>
<path d="M32 3 57 17.5v29L32 61 7 46.5v-29z" fill="#0c0d10" stroke="url(#g)" stroke-width="4"/>
<path d="M32 15v10M32 39v10M15 32h10M39 32h10" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/>
<circle cx="32" cy="32" r="4.5" fill="url(#g)"/></svg>`;

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'logo.svg'), LOGO_SVG);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${LOGO_SVG.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(outDir, `icon-${size}.png`), omitBackground: true });
}
await browser.close();
console.log('✓ icons');
