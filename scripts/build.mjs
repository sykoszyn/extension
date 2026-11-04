#!/usr/bin/env node
/**
 * Production build. Runs three Vite builds into dist/_build and then emits
 * one ready-to-load folder per browser in dist/<target>/.
 *
 *   1. Extension pages (dashboard + popup) — ES modules, code-split.
 *   2. background.js — single IIFE file (works as Chromium SW and Firefox event page).
 *   3. content.js — single IIFE file (MV3 content scripts can't be ES modules).
 *
 * Usage: node scripts/build.mjs [chrome|edge|brave|opera|firefox ...]
 *
 * Config: sykos.config.json → { "proxyUrl": "https://sykostracker-proxy.<you>.workers.dev" }
 * (env SYKOS_PROXY_URL overrides it; env SYKOS_DIST changes the output folder).
 * The proxy URL is public; the FACEIT key stays a secret inside the Worker.
 */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildManifest, TARGETS } from '../extension/manifest/build-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const r = (...p) => path.join(root, ...p);
const distDir = path.resolve(root, process.env.SYKOS_DIST ?? 'dist');
const out = path.join(distDir, '_build');
const alias = { '@shared': r('shared'), '@ext': r('extension'), '@dash': r('dashboard') };
// No API key is ever compiled into the extension. Only the PUBLIC proxy URL is.
const cfg = existsSync(r('sykos.config.json')) ? JSON.parse(await readFile(r('sykos.config.json'), 'utf8')) : {};
const proxyUrl = String(process.env.SYKOS_PROXY_URL ?? cfg.proxyUrl ?? '').trim().replace(/\/+$/, '');
if (proxyUrl && !/^https:\/\/[^/]+$/.test(proxyUrl)) throw new Error(`proxyUrl must be https://host with no path, got "${proxyUrl}"`);
console.log(proxyUrl ? `› proxy: ${proxyUrl}` : '› proxy: none (users must paste their own FACEIT API key)');
const define = { 'process.env.NODE_ENV': JSON.stringify('production'), __SYKOS_PROXY_URL__: JSON.stringify(proxyUrl) };
const targets = process.argv.slice(2).length ? process.argv.slice(2) : TARGETS;
const pkg = JSON.parse(await readFile(r('package.json'), 'utf8'));

await rm(distDir, { recursive: true, force: true });

const common = { root, configFile: false, logLevel: 'warn', resolve: { alias }, define, plugins: [react()] };

console.log('› pages (dashboard, popup)');
await build({
  ...common,
  base: '/',
  build: {
    outDir: out,
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: { dashboard: r('dashboard/index.html'), popup: r('extension/popup/index.html') },
      output: { manualChunks: { recharts: ['recharts'] } },
    },
  },
});

for (const [name, entry] of [
  ['background', 'extension/background/index.ts'],
  ['content', 'extension/content/index.tsx'],
]) {
  console.log(`› ${name}.js`);
  await build({
    ...common,
    build: {
      outDir: out,
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: false,
      copyPublicDir: false,
      lib: { entry: r(entry), name: `sykos_${name}`, formats: ['iife'], fileName: () => `${name}.js` },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
}

if (!existsSync(r('extension/assets/icons/icon-128.png'))) {
  throw new Error('Missing icons. Run: node scripts/icons.mjs');
}

for (const t of targets) {
  const dir = path.join(distDir, t);
  await mkdir(dir, { recursive: true });
  await cp(out, dir, { recursive: true });
  await cp(r('extension/assets/icons'), path.join(dir, 'icons'), { recursive: true });
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(buildManifest(t, pkg.version, { proxyUrl }), null, 2));
  console.log(`✓ ${path.relative(root, dir)}`);
}
await rm(out, { recursive: true, force: true });
