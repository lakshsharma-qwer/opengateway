import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, signup } from './helpers.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('/v1 API key auth', async () => {
  const m = await signup(srv);
  const none = await srv.request('GET', '/v1/orders');
  assert.equal(none.status, 401);
  assert.deepEqual(Object.keys(none.json.error).sort(), ['code', 'field', 'message', 'type']);
  assert.equal(none.json.error.code, 'INVALID_API_KEY');
  assert.equal(none.json.error.type, 'authentication_error');
  const wrong = await srv.request('GET', '/v1/orders', { auth: { key_id: m.key.key_id, key_secret: 'nope' } });
  assert.equal(wrong.status, 401);
  const ok = await srv.request('GET', '/v1/orders', { auth: m.key });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.entity, 'collection');
  assert.ok(ok.headers.get('ratelimit-limit'));
  assert.equal(ok.headers.get('access-control-allow-origin'), '*');

  // Rotating the key revokes the old one.
  const nk = await srv.request('POST', '/api/api-keys', { cookie: m.cookie, body: { mode: 'test' } });
  assert.equal(nk.status, 201);
  assert.match(nk.json.key_id, /^og_test_/);
  const old = await srv.request('GET', '/v1/orders', { auth: m.key });
  assert.equal(old.status, 401);
  const fresh = await srv.request('GET', '/v1/orders', { auth: { key_id: nk.json.key_id, key_secret: nk.json.key_secret } });
  assert.equal(fresh.status, 200);
  const keys = await srv.request('GET', '/api/api-keys?mode=test', { cookie: m.cookie });
  assert.deepEqual(keys.json.items.map((k) => k.status).sort(), ['active', 'revoked']);
});

test('mode isolation: live key cannot see test orders', async () => {
  const m = await signup(srv);
  const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 1000 } })).json;
  const lk = (await srv.request('POST', '/api/api-keys', { cookie: m.cookie, body: { mode: 'live' } })).json;
  const live = { key_id: lk.key_id, key_secret: lk.key_secret };
  const g = await srv.request('GET', `/v1/orders/${o.id}`, { auth: live });
  assert.equal(g.status, 404);
  const sim = await srv.request('POST', `/v1/test/orders/${o.id}/simulate`, { auth: live, body: { outcome: 'success' } });
  assert.equal(sim.status, 403);
  assert.equal(sim.json.error.code, 'TEST_MODE_ONLY');
  const noVpa = await srv.request('POST', '/v1/orders', { auth: live, body: { amount: 1000 } });
  assert.equal(noVpa.json.error.code, 'NO_VPA_CONFIGURED');
});

test('dashboard sessions: signup, me, logout, login', async () => {
  const email = `me-${Date.now()}@example.com`;
  const m = await signup(srv, { email });
  const me = await srv.request('GET', '/api/auth/me', { cookie: m.cookie });
  assert.equal(me.json.user.email, email);
  assert.equal(me.json.user.role, 'owner');
  assert.equal(me.json.merchant.business_name, 'Test Shop');
  assert.equal(me.json.merchant.live_enabled, false);
  assert.equal(me.json.merchant.onboarding_completed, false);

  const dupe = await srv.request('POST', '/api/auth/signup', { body: { name: 'X', email, password: 'password123', business_name: 'Y' } });
  assert.equal(dupe.status, 409);

  const short = await srv.request('POST', '/api/auth/signup', { body: { name: 'X', email: 'z@example.com', password: 'short', business_name: 'Y' } });
  assert.equal(short.json.error.field, 'password');

  await srv.request('POST', '/api/auth/logout', { cookie: m.cookie });
  const gone = await srv.request('GET', '/api/auth/me', { cookie: m.cookie });
  assert.equal(gone.status, 401);
  const unauth = await srv.request('GET', '/api/orders');
  assert.equal(unauth.status, 401);

  const bad = await srv.request('POST', '/api/auth/login', { body: { email, password: 'wrongpass1' } });
  assert.equal(bad.status, 401);
  assert.equal(bad.json.error.code, 'INVALID_CREDENTIALS');
  const login = await srv.request('POST', '/api/auth/login', { body: { email, password: 'password123' } });
  assert.equal(login.status, 200);
  const set = login.headers.get('set-cookie');
  assert.match(set, /og_session=/);
  assert.match(set, /HttpOnly/i);
  assert.match(set, /SameSite=Lax/i);
});

test('roles: viewer read-only, developer cannot manage team or refunds, admin can', async () => {
  const owner = await signup(srv);
  const mkUser = async (role) => {
    const email = `${role}-${Date.now()}@example.com`;
    const r = await srv.request('POST', '/api/team', { cookie: owner.cookie, body: { name: role, email, role, password: 'password123' } });
    assert.equal(r.status, 201, r.text);
    const l = await srv.request('POST', '/api/auth/login', { body: { email, password: 'password123' } });
    return { id: r.json.id, cookie: l.headers.get('set-cookie').split(';')[0] };
  };
  const viewer = await mkUser('viewer');
  const dev = await mkUser('developer');
  const admin = await mkUser('admin');

  // Viewer: GET ok, any write forbidden.
  assert.equal((await srv.request('GET', '/api/orders?mode=test', { cookie: viewer.cookie })).status, 200);
  const vw = await srv.request('POST', '/api/orders', { cookie: viewer.cookie, body: { amount: 1000 } });
  assert.equal(vw.status, 403);
  assert.equal((await srv.request('PATCH', '/api/settings', { cookie: viewer.cookie, body: { brand_color: '#000000' } })).status, 403);

  // Developer: can manage keys/webhooks, not team or refunds.
  assert.equal((await srv.request('POST', '/api/api-keys', { cookie: dev.cookie, body: { mode: 'test' } })).status, 201);
  assert.equal((await srv.request('POST', '/api/team', { cookie: dev.cookie, body: { name: 'x', email: 'x1@example.com', role: 'viewer', password: 'password123' } })).status, 403);
  assert.equal((await srv.request('POST', '/api/refunds', { cookie: dev.cookie, body: { payment_id: 'pay_x' } })).status, 403);
  assert.equal((await srv.request('DELETE', `/api/team/${viewer.id}`, { cookie: dev.cookie })).status, 403);

  // Admin: can manage team (not admins/owner), can do refunds.
  const p = await srv.request('PATCH', `/api/team/${viewer.id}`, { cookie: admin.cookie, body: { role: 'developer' } });
  assert.equal(p.status, 200);
  assert.equal(p.json.role, 'developer');
  assert.equal((await srv.request('PATCH', `/api/team/${owner.user.id}`, { cookie: admin.cookie, body: { role: 'viewer' } })).status, 403);
  const rf = await srv.request('POST', '/api/refunds', { cookie: admin.cookie, body: { payment_id: 'pay_x' } });
  assert.equal(rf.status, 404, 'passes the role check, payment not found');
  const team = await srv.request('GET', '/api/team', { cookie: dev.cookie });
  assert.equal(team.json.items.length, 4);
});

test('auth endpoints are rate limited per IP', async () => {
  const limited = await startTestServer({ rateLimits: { auth: 2 } });
  try {
    let last;
    for (let i = 0; i < 3; i++) last = await limited.request('POST', '/api/auth/login', { body: { email: 'a@b.co', password: 'x' } });
    assert.equal(last.status, 429);
    assert.ok(last.headers.get('retry-after'));
  } finally {
    await limited.close();
  }
});

test('settings, VPAs, observers, live enable', async () => {
  const m = await signup(srv);
  const bad = await srv.request('POST', '/api/vpas', { cookie: m.cookie, body: { vpa: 'not a vpa', payee_name: 'x' } });
  assert.equal(bad.json.error.field, 'vpa');
  const v2 = await srv.request('POST', '/api/vpas', { cookie: m.cookie, body: { vpa: 'second@ybl', payee_name: 'Shop 2', label: 'Counter' } });
  assert.equal(v2.json.is_default, false);
  const pd = await srv.request('PATCH', `/api/vpas/${v2.json.id}`, { cookie: m.cookie, body: { is_default: true } });
  assert.equal(pd.json.is_default, true);
  const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 1000 } })).json;
  assert.equal(o.vpa, 'second@ybl');

  const s = await srv.request('PATCH', '/api/settings', { cookie: m.cookie, body: { brand_color: '#123abc', order_expiry_seconds: 600, onboarding_completed: true } });
  assert.equal(s.json.brand_color, '#123abc');
  assert.equal(s.json.order_expiry_seconds, 600);
  assert.equal((await srv.request('PATCH', '/api/settings', { cookie: m.cookie, body: { brand_color: 'purple' } })).status, 400);

  const tp = await srv.request('POST', '/api/observers/test-parse', { cookie: m.cookie, body: { text: 'Rs 10 credited UTR 123456789012' } });
  assert.deepEqual(tp.json, { direction: 'credit', amount: 1000, utr: '123456789012', payer_vpa: null });

  const live1 = await srv.request('POST', '/api/live/enable', { cookie: m.cookie });
  assert.equal(live1.status, 400);
  await srv.request('POST', '/api/vpas', { cookie: m.cookie, body: { vpa: 'live@okhdfc', payee_name: 'Live', mode: 'live' } });
  const live2 = await srv.request('POST', '/api/live/enable', { cookie: m.cookie });
  assert.equal(live2.status, 200);
  assert.equal(live2.json.live_enabled, true);
});
