#!/usr/bin/env node
/** Zips every dist/<target> folder into dist/sykostracker-<target>-<version>.zip (uses the system `zip`). */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const dist = path.join(root, 'dist');

for (const t of readdirSync(dist)) {
  const dir = path.join(dist, t);
  if (!statSync(dir).isDirectory()) continue;
  const zip = path.join(dist, `sykostracker-${t}-${version}.zip`);
  try {
    execFileSync('zip', ['-qr', '-X', zip, '.'], { cwd: dir, stdio: 'inherit' });
    console.log(`✓ ${path.relative(root, zip)}`);
  } catch {
    console.error('`zip` not found. Install it or compress the dist/<target> folders manually.');
    process.exit(1);
  }
}
