/**
 * Starts an isolated OpenGateway stack for the e2e suite:
 *   - a fresh temp DATA_DIR, seeded with the demo merchant
 *   - the API server on :4100 (serving web/dist)
 *   - a tiny webhook receiver on :4101 that answers 200 and records deliveries
 * Credentials for the seeded merchant are written to e2e/.run/creds.json.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const runDir = path.resolve(here, '../.run');
const PORT = Number(process.env.OG_E2E_PORT || 4100);
const HOOK_PORT = PORT + 1;
const PUBLIC_URL = `http://localhost:${PORT}`;

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-e2e-'));
fs.mkdirSync(runDir, { recursive: true });

const env = {
  ...process.env,
  NODE_ENV: 'production',
  DATA_DIR: dataDir,
  PORT: String(PORT),
  PUBLIC_URL,
  DEMO_STORE_URL: `http://localhost:${HOOK_PORT}`,
};

const seed = spawnSync(process.execPath, ['scripts/seed.js'], { cwd: path.join(root, 'server'), env, encoding: 'utf8' });
if (seed.status !== 0) {
  console.error(seed.stdout, seed.stderr);
  process.exit(1);
}
const creds = JSON.parse(fs.readFileSync(path.join(dataDir, 'demo-credentials.json'), 'utf8'));
fs.writeFileSync(path.join(runDir, 'creds.json'), JSON.stringify({ ...creds, data_dir: dataDir, base_url: PUBLIC_URL, hook_url: `http://localhost:${HOOK_PORT}` }, null, 2));

// Webhook receiver: always 200, keeps the last 500 deliveries at GET /deliveries.
const received = [];
const hooks = http.createServer((req, res) => {
  // A minimal merchant page that embeds checkout.js (served from a loopback origin so
  // Chrome's Private Network Access rules allow it to load the gateway's script).
  if (req.method === 'GET' && req.url.startsWith('/shop')) {
    const ps = new URL(req.url, 'http://x').searchParams.get('ps') || '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shop</title></head>
<body><h1>Demo shop</h1><button id="buy">Buy now</button><pre id="out"></pre>
<script src="${PUBLIC_URL}/checkout.js"></script>
<script>
  window.__events = [];
  const out = (o) => { window.__events.push(o); document.getElementById('out').textContent = JSON.stringify(window.__events); };
  document.getElementById('buy').onclick = () => new OpenGateway({
    session_id: ${JSON.stringify(ps)}, mode: 'modal',
    onSuccess: (r) => out(Object.assign({ type: 'success' }, r)),
    onFailure: (r) => out(Object.assign({ type: 'failure' }, r)),
    onClose: () => out({ type: 'close' }),
  }).open();
</script></body></html>`);
  }
  if (req.method === 'GET' && req.url === '/deliveries') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(received));
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    received.unshift({ url: req.url, headers: req.headers, body });
    received.length = Math.min(received.length, 500);
    res.setHeader('Content-Type', 'application/json');
    res.end('{"ok":true}');
  });
});
hooks.listen(HOOK_PORT);

const server = spawn(process.execPath, ['src/index.js'], { cwd: path.join(root, 'server'), env, stdio: 'inherit' });

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  hooks.close();
  server.kill('SIGTERM');
  const t = setTimeout(() => server.kill('SIGKILL'), 5000);
  server.on('exit', () => {
    clearTimeout(t);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
    process.exit(code);
  });
}
server.on('exit', (c) => { if (!stopping) { hooks.close(); process.exit(c ?? 1); } });
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
