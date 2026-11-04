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
const out = r('dist', '_build');
const alias = { '@shared': r('shared'), '@ext': r('extension'), '@dash': r('dashboard') };
// No API key is ever compiled into the extension: each user pastes their own in Settings.
const define = { 'process.env.NODE_ENV': JSON.stringify('production') };
const targets = process.argv.slice(2).length ? process.argv.slice(2) : TARGETS;
const pkg = JSON.parse(await readFile(r('package.json'), 'utf8'));

await rm(r('dist'), { recursive: true, force: true });

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
  const dir = r('dist', t);
  await mkdir(dir, { recursive: true });
  await cp(out, dir, { recursive: true });
  await cp(r('extension/assets/icons'), path.join(dir, 'icons'), { recursive: true });
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(buildManifest(t, pkg.version), null, 2));
  console.log(`✓ dist/${t}`);
}
await rm(out, { recursive: true, force: true });
