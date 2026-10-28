import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

export async function startTestServer(overrides = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'og-test-'));
  const config = loadConfig({
    dataDir,
    masterKey: '7'.repeat(64),
    publicUrl: 'http://localhost:5173',
    webhookTimeoutMs: 2000,
    ...overrides,
    rateLimits: { v1: 1000, auth: 1000, confirm: 1000, windowMs: 60_000, ...(overrides.rateLimits || {}) },
  });
  const db = openDb(':memory:');
  const app = createApp({ db, config });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, url, { body, headers = {}, cookie, auth, raw } = {}) {
    const h = { ...headers };
    if (cookie) h.Cookie = cookie;
    if (auth) h.Authorization = 'Basic ' + Buffer.from(`${auth.key_id}:${auth.key_secret}`).toString('base64');
    let payload;
    if (raw !== undefined) payload = raw;
    else if (body !== undefined) {
      payload = JSON.stringify(body);
      h['Content-Type'] = 'application/json';
    }
    const res = await fetch(base + url, { method, headers: h, body: payload, redirect: 'manual' });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, headers: res.headers, json, text };
  }

  return {
    db, config, base, request,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
  };
}

let n = 0;
/** Sign up a merchant, add a test VPA. Returns { cookie, key, user, merchant }. */
export async function signup(srv, { vpa = 'shop@okaxis', email } = {}) {
  n++;
  const res = await srv.request('POST', '/api/auth/signup', {
    body: { name: 'Owner', email: email || `owner${n}-${Date.now()}@example.com`, password: 'password123', business_name: 'Test Shop', phone: '9876543210' },
  });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${res.text}`);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  if (vpa) {
    const v = await srv.request('POST', '/api/vpas?mode=test', { cookie, body: { vpa, payee_name: 'Test Shop' } });
    if (v.status !== 201) throw new Error(`vpa failed: ${v.status} ${v.text}`);
  }
  return { cookie, key: res.json.test_key, user: res.json.user, merchant: res.json.merchant };
}

/** A local HTTP server that records webhook requests. */
export async function startWebhookReceiver(statusFor = () => 200) {
  const received = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      received.push({ headers: req.headers, raw, body: JSON.parse(raw || 'null') });
      res.statusCode = statusFor(received.length);
      res.end('ok');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${server.address().port}/hook`,
    received,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
  };
}
