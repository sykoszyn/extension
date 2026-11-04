#!/usr/bin/env node
/**
 * TEST-ONLY local stand-in for the Supabase `faceit-proxy` Edge Function,
 * answering with deterministic fixtures. Lets you run the extension UI
 * without a FACEIT key: set Backend URL = http://localhost:8787 and any anon key.
 */
import http from 'node:http';
import { handle } from '../tests/fixtures/mock-faceit.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-sykos-install',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') return res.writeHead(204, CORS).end();
    if (req.method !== 'POST' || req.url !== '/functions/v1/faceit-proxy') return res.writeHead(404, CORS).end();
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { path, query } = JSON.parse(body || '{}');
      const out = handle(path, query);
      setTimeout(() => res.writeHead(out.status, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(out.body)), 40);
    });
  })
  .listen(PORT, () => console.log(`mock faceit-proxy on http://localhost:${PORT}`));
