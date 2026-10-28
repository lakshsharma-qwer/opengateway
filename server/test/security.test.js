/** Web security + webhook dispatcher resilience. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startTestServer, signup, startWebhookReceiver } from './helpers.js';
import { all, one, run } from '../src/db.js';
import { runJobsOnce } from '../src/jobs.js';
import { createDelivery, attemptDelivery, postWebhook, settings as whSettings, waitForDeliveries } from '../src/lib/webhooks.js';
import { checkWebhookUrl, isPrivateAddress } from '../src/lib/netguard.js';
import { redactUrl } from '../src/lib/errors.js';
import { ids } from '../src/lib/ids.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await waitForDeliveries(); await srv.close(); });

async function rawServer(handler) {
  const s = http.createServer(handler);
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${s.address().port}`, port: s.address().port, close: () => new Promise((r) => { s.closeAllConnections?.(); s.close(r); }) };
}

// ------------------------------------------------------------------ CSRF

test('CSRF: cross-site state-changing /api requests are rejected; same-origin and dev proxy allowed', async () => {
  const m = await signup(srv);
  const evil = await srv.request('POST', '/api/orders', { cookie: m.cookie, body: { amount: 1000 }, headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.status, 403);
  assert.equal(evil.json.error.code, 'CSRF_REJECTED');
  const site = await srv.request('POST', '/api/orders', { cookie: m.cookie, body: { amount: 1000 }, headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(site.status, 403);
  const nullOrigin = await srv.request('POST', '/api/orders', { cookie: m.cookie, body: { amount: 1000 }, headers: { Origin: 'null' } });
  assert.equal(nullOrigin.status, 403);
  const loginCsrf = await srv.request('POST', '/api/auth/login', { body: { email: 'a@b.co', password: 'x' }, headers: { Origin: 'https://evil.example' } });
  assert.equal(loginCsrf.status, 403);
  const logoutCsrf = await srv.request('POST', '/api/auth/logout', { cookie: m.cookie, headers: { Origin: 'https://evil.example' } });
  assert.equal(logoutCsrf.status, 403);

  const dev = await srv.request('POST', '/api/orders', { cookie: m.cookie, body: { amount: 1000 }, headers: { Origin: 'http://localhost:5173', 'Sec-Fetch-Site': 'same-origin' } });
  assert.equal(dev.status, 201);
  const same = await srv.request('POST', '/api/orders', { cookie: m.cookie, body: { amount: 1000 }, headers: { 'Sec-Fetch-Site': 'same-origin' } });
  assert.equal(same.status, 201);
  const getCross = await srv.request('GET', '/api/orders', { cookie: m.cookie, headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(getCross.status, 200, 'safe methods are not blocked');
  // Public checkout API has no cookie authority: merchant pages / iframes may call it.
  const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 1000 } })).json;
  const co = await srv.request('POST', `/api/checkout/${o.payment_session_id}/attempt`, { body: { flow: 'qr' }, headers: { Origin: 'https://shop.example' } });
  assert.equal(co.status, 200);
});

// ------------------------------------------------------------------ headers

test('security headers: nosniff everywhere, /pay embeddable, everything else frame-denied', async () => {
  const api = await srv.request('GET', '/health');
  assert.equal(api.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(api.headers.get('x-frame-options'), 'DENY');
  assert.match(api.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const pay = await srv.request('GET', '/pay/ps_abc');
  assert.equal(pay.headers.get('x-frame-options'), null);
  assert.match(pay.headers.get('content-security-policy'), /frame-ancestors \*/);
  assert.equal(pay.headers.get('referrer-policy'), 'no-referrer');
  const dash = await srv.request('GET', '/dashboard');
  assert.equal(dash.headers.get('x-frame-options'), 'DENY');
  assert.match(dash.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(dash.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(dash.headers.get('x-content-type-options'), 'nosniff');
  const linkErr = await srv.request('GET', '/l/nope');
  assert.equal(linkErr.headers.get('x-content-type-options'), 'nosniff');
});

test('payment-link error page escapes merchant-controlled text', async () => {
  const m = await signup(srv);
  const link = (await srv.request('POST', '/v1/payment_links', { auth: m.key, body: { amount: 1000 } })).json;
  // Remove the VPA so the page renders an error message.
  run(srv.db, 'UPDATE vpas SET active=0 WHERE merchant_id=?', m.merchant.id);
  const code = link.short_url.split('/').pop();
  const r = await srv.request('GET', `/l/${code}`);
  assert.equal(r.status, 400);
  assert.doesNotMatch(r.text, /<script/i);
});

// ------------------------------------------------------------------ SSRF

test('SSRF: address classification', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::']) {
    assert.ok(isPrivateAddress(ip), ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.ok(!isPrivateAddress(ip), ip);
  assert.equal(checkWebhookUrl('http://127.0.0.1:4000/x', 'test'), null, 'loopback allowed in test mode');
  assert.ok(checkWebhookUrl('http://127.0.0.1:4000/x', 'live'));
  assert.ok(checkWebhookUrl('http://localhost./x', 'live'));
  assert.ok(checkWebhookUrl('http://169.254.169.254/latest/meta-data', 'test'), 'metadata blocked even in test mode');
  assert.ok(checkWebhookUrl('http://[::ffff:10.0.0.1]/', 'live'));
  assert.ok(checkWebhookUrl('http://0x7f.1/', 'live'));
  assert.equal(checkWebhookUrl('https://hooks.example.com/og', 'live'), null);
});

test('SSRF: live webhooks to private / loopback / link-local are rejected on create and update', async () => {
  const m = await signup(srv);
  for (const url of ['http://127.0.0.1/', 'http://localhost:4000/', 'http://10.0.0.5/', 'http://169.254.169.254/latest', 'http://[::1]/', 'http://192.168.0.1/']) {
    const r = await srv.request('POST', '/api/webhooks', { cookie: m.cookie, body: { url, mode: 'live' } });
    assert.equal(r.status, 400, url);
    assert.equal(r.json.error.field, 'url');
  }
  const ok = await srv.request('POST', '/api/webhooks', { cookie: m.cookie, body: { url: 'https://hooks.example.com/og', mode: 'live' } });
  assert.equal(ok.status, 201);
  const upd = await srv.request('PATCH', `/api/webhooks/${ok.json.id}`, { cookie: m.cookie, body: { url: 'http://127.0.0.1:9/' } });
  assert.equal(upd.status, 400);
  const testMeta = await srv.request('POST', '/api/webhooks', { cookie: m.cookie, body: { url: 'http://169.254.169.254/', mode: 'test' } });
  assert.equal(testMeta.status, 400);
  const testLocal = await srv.request('POST', '/api/webhooks', { cookie: m.cookie, body: { url: 'http://127.0.0.1:9/hook', mode: 'test' } });
  assert.equal(testLocal.status, 201);
});

test('SSRF: blocked again after DNS resolution (live mode hostname resolving to loopback)', async () => {
  const target = await rawServer((req, res) => res.end('reached'));
  try {
    // "localhost" passes no static check here because we call the transport directly, as a hostname
    // that *resolves* to 127.0.0.1 would (DNS rebinding).
    const r = await postWebhook(`http://localhost:${target.port}/`, { mode: 'live', body: '{}', headers: {} });
    assert.equal(r.status, null);
    assert.match(r.text, /blocked/i);
    const t = await postWebhook(`http://localhost:${target.port}/`, { mode: 'test', body: '{}', headers: {} });
    assert.equal(t.status, 200);
  } finally { await target.close(); }
});

// ------------------------------------------------------------------ webhook resilience

async function endpointFor(m, url) {
  const wh = await srv.request('POST', '/api/webhooks', { cookie: m.cookie, body: { url, events: ['*'] } });
  assert.equal(wh.status, 201, wh.text);
  return wh.json;
}
function pendingDelivery(m, wh) {
  const evId = ids.event();
  run(srv.db, 'INSERT INTO events (id, merchant_id, mode, type, data, created_at) VALUES (?,?,?,?,?,?)', evId, m.merchant.id, 'test', 'ping', '{}', Math.floor(Date.now() / 1000));
  return createDelivery(srv.db, { merchantId: m.merchant.id, mode: 'test', endpointId: wh.id, eventId: evId, eventType: 'ping' });
}

test('webhooks: redirects are not followed', async () => {
  const m = await signup(srv);
  const second = await startWebhookReceiver();
  const first = await rawServer((req, res) => { res.writeHead(302, { Location: second.url }); res.end(); });
  try {
    const wh = await endpointFor(m, `${first.url}/hook`);
    const d = await attemptDelivery(srv.db, pendingDelivery(m, wh));
    assert.equal(d.response_status, 302);
    assert.equal(d.status, 'pending', 'treated as a failure and retried later');
    assert.match(d.response_body, /Redirect not followed/);
    assert.equal(second.received.length, 0);
  } finally { await first.close(); await second.close(); }
});

test('webhooks: hung endpoint times out; huge response is capped', async () => {
  const m = await signup(srv);
  const hung = await rawServer(() => { /* never respond */ });
  const huge = await rawServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    const chunk = Buffer.alloc(64 * 1024, 'a');
    let n = 0;
    const pump = () => { while (n < 200 && res.write(chunk)) n++; if (n < 200) res.once('drain', pump); else res.end(); };
    pump();
  });
  const prev = whSettings.timeoutMs;
  whSettings.timeoutMs = 400;
  try {
    const wh1 = await endpointFor(m, `${hung.url}/hook`);
    const t0 = Date.now();
    const d1 = await attemptDelivery(srv.db, pendingDelivery(m, wh1));
    assert.ok(Date.now() - t0 < 3000);
    assert.equal(d1.response_status, null);
    assert.match(d1.response_body, /Timed out/);
    assert.equal(d1.status, 'pending');
    const wh2 = await endpointFor(m, `${huge.url}/hook`);
    const d2 = await attemptDelivery(srv.db, pendingDelivery(m, wh2));
    assert.equal(d2.status, 'success');
    assert.ok(d2.response_body.length <= 2048);
  } finally {
    whSettings.timeoutMs = prev;
    await hung.close(); await huge.close();
  }
});

test('webhooks: concurrent attempts of one delivery send once (lease); pending deliveries survive a restart', async () => {
  const m = await signup(srv);
  const hook = await startWebhookReceiver();
  try {
    const wh = await endpointFor(m, hook.url);
    const id = pendingDelivery(m, wh);
    await Promise.all([attemptDelivery(srv.db, id), attemptDelivery(srv.db, id)]);
    assert.equal(hook.received.length, 1);
    // "Restart": a delivery left pending in the DB (e.g. process died mid-retry, lease expired) is
    // picked up by the job runner of a fresh process.
    const id2 = pendingDelivery(m, wh);
    run(srv.db, 'UPDATE webhook_deliveries SET attempts=2, next_attempt_at=? WHERE id=?', Math.floor(Date.now() / 1000) - 1, id2);
    await runJobsOnce(srv.db);
    const d = one(srv.db, 'SELECT * FROM webhook_deliveries WHERE id=?', id2);
    assert.equal(d.status, 'success');
    assert.equal(d.attempts, 3);
    // A delivery under an active lease (another worker is sending it) is not double-sent.
    const id3 = pendingDelivery(m, wh);
    run(srv.db, 'UPDATE webhook_deliveries SET next_attempt_at=? WHERE id=?', Math.floor(Date.now() / 1000) + 30, id3);
    const before = hook.received.length;
    await attemptDelivery(srv.db, id3);
    await runJobsOnce(srv.db);
    assert.equal(hook.received.length, before);
  } finally { await hook.close(); }
});

// ------------------------------------------------------------------ auth

test('login lockout after repeated failures (also for unknown emails)', async () => {
  const s = await startTestServer({ loginLockout: { maxFailures: 3, windowMs: 60_000, lockMs: 60_000 } });
  try {
    const email = `lock-${Date.now()}@example.com`;
    await signup(s, { email });
    for (let i = 0; i < 3; i++) {
      const r = await s.request('POST', '/api/auth/login', { body: { email, password: 'wrong-password' } });
      assert.equal(r.status, 401);
    }
    const locked = await s.request('POST', '/api/auth/login', { body: { email, password: 'password123' } });
    assert.equal(locked.status, 429);
    assert.equal(locked.json.error.code, 'ACCOUNT_LOCKED');
    assert.ok(locked.headers.get('retry-after'));
    for (let i = 0; i < 3; i++) await s.request('POST', '/api/auth/login', { body: { email: 'ghost@example.com', password: 'x' } });
    const ghost = await s.request('POST', '/api/auth/login', { body: { email: 'ghost@example.com', password: 'x' } });
    assert.equal(ghost.json.error.code, 'ACCOUNT_LOCKED', 'unknown accounts behave the same (no enumeration)');
  } finally { await s.close(); }
});

test('password change invalidates all existing sessions; logout invalidates server-side', async () => {
  const email = `pw-${Date.now()}@example.com`;
  const m = await signup(srv, { email });
  const other = (await srv.request('POST', '/api/auth/login', { body: { email, password: 'password123' } })).headers.get('set-cookie').split(';')[0];
  const wrong = await srv.request('POST', '/api/auth/change-password', { cookie: m.cookie, body: { current_password: 'nope-nope', new_password: 'newpassword1' } });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.json.error.field, 'current_password');
  const ok = await srv.request('POST', '/api/auth/change-password', { cookie: m.cookie, body: { current_password: 'password123', new_password: 'newpassword1' } });
  assert.equal(ok.status, 200);
  const fresh = ok.headers.get('set-cookie').split(';')[0];
  assert.equal((await srv.request('GET', '/api/auth/me', { cookie: m.cookie })).status, 401);
  assert.equal((await srv.request('GET', '/api/auth/me', { cookie: other })).status, 401);
  assert.equal((await srv.request('GET', '/api/auth/me', { cookie: fresh })).status, 200);
  assert.equal((await srv.request('POST', '/api/auth/login', { body: { email, password: 'password123' } })).status, 401);
  assert.equal((await srv.request('POST', '/api/auth/login', { body: { email, password: 'newpassword1' } })).status, 200);
  await srv.request('POST', '/api/auth/logout', { cookie: fresh });
  assert.equal(one(srv.db, 'SELECT COUNT(*) AS n FROM sessions WHERE user_id=?', m.user.id).n, 1, 'only the login above remains');
});

test('login rotates the session id (no fixation)', async () => {
  const email = `fix-${Date.now()}@example.com`;
  const m = await signup(srv, { email });
  const l = await srv.request('POST', '/api/auth/login', { cookie: m.cookie, body: { email, password: 'password123' } });
  const next = l.headers.get('set-cookie').split(';')[0];
  assert.notEqual(next, m.cookie);
  assert.equal((await srv.request('GET', '/api/auth/me', { cookie: m.cookie })).status, 401);
  assert.equal((await srv.request('GET', '/api/auth/me', { cookie: next })).status, 200);
});

test('concurrent signups with the same email: one 201, one 409 (never 500)', async () => {
  const email = `race-${Date.now()}@example.com`;
  const body = { name: 'X', email, password: 'password123', business_name: 'Y' };
  const rs = await Promise.all([srv.request('POST', '/api/auth/signup', { body }), srv.request('POST', '/api/auth/signup', { body })]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
  const m = await signup(srv);
  const tb = { name: 'T', email: `team-${Date.now()}@example.com`, role: 'viewer', password: 'password123' };
  const ts = await Promise.all([srv.request('POST', '/api/team', { cookie: m.cookie, body: tb }), srv.request('POST', '/api/team', { cookie: m.cookie, body: tb })]);
  assert.deepEqual(ts.map((r) => r.status).sort(), [201, 409]);
});

// ------------------------------------------------------------------ secrets / tokens

test('observer tokens are hashed at rest and never logged in api_logs', async () => {
  const m = await signup(srv);
  const obs = (await srv.request('POST', '/api/observers', { cookie: m.cookie, body: { name: 'P' } })).json;
  const row = one(srv.db, 'SELECT * FROM observers WHERE id=?', obs.id);
  assert.ok(!Object.values(row).some((v) => String(v).includes(obs.token)));
  await srv.request('POST', `/v1/observers/ingest?token=${encodeURIComponent(obs.token)}`, { body: { text: 'hello' } });
  const logs = all(srv.db, 'SELECT * FROM api_logs WHERE merchant_id=?', m.merchant.id);
  assert.ok(logs.length >= 1);
  assert.ok(logs.every((l) => !String(l.path).includes(obs.token) && !String(l.path).includes('token')));
  assert.equal(redactUrl('/v1/observers/ingest?token=obt_secret&x=1'), '/v1/observers/ingest?token=[redacted]&x=1');
  // API key secrets are only stored hashed + encrypted.
  const key = one(srv.db, 'SELECT * FROM api_keys WHERE id=?', m.key.key_id);
  assert.ok(!Object.values(key).some((v) => String(v).includes(m.key.key_secret)));
});

test('ingest is rate limited per IP even with bad tokens', async () => {
  const s = await startTestServer({ rateLimits: { ingest: 3 } });
  try {
    let last;
    for (let i = 0; i < 4; i++) last = await s.request('POST', '/v1/observers/ingest?token=bad', { body: { text: 'x' } });
    assert.equal(last.status, 429);
    assert.equal(last.json.error.type, 'rate_limit_error');
  } finally { await s.close(); }
});
