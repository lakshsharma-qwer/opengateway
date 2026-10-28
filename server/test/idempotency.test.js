import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, signup } from './helpers.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

test('same key + same body replays; different body -> 409', async () => {
  const { key } = await signup(srv);
  const headers = { 'Idempotency-Key': 'order-abc-1' };
  const a = await srv.request('POST', '/v1/orders', { auth: key, headers, body: { amount: 12300, receipt: 'r1' } });
  assert.equal(a.status, 201);
  assert.equal(a.headers.get('idempotent-replayed'), null);
  const b = await srv.request('POST', '/v1/orders', { auth: key, headers, body: { receipt: 'r1', amount: 12300 } });
  assert.equal(b.status, 201);
  assert.equal(b.headers.get('idempotent-replayed'), 'true');
  assert.equal(b.json.id, a.json.id);
  const list = await srv.request('GET', '/v1/orders?receipt=r1', { auth: key });
  assert.equal(list.json.count, 1, 'no second order created');
  const c = await srv.request('POST', '/v1/orders', { auth: key, headers, body: { amount: 99900, receipt: 'r1' } });
  assert.equal(c.status, 409);
  assert.equal(c.json.error.code, 'IDEMPOTENCY_KEY_REUSED');
  assert.equal(c.json.error.type, 'conflict_error');
});

test('keys are scoped per merchant', async () => {
  const m1 = await signup(srv);
  const m2 = await signup(srv);
  const headers = { 'Idempotency-Key': 'shared-key' };
  const a = await srv.request('POST', '/v1/orders', { auth: m1.key, headers, body: { amount: 1000 } });
  const b = await srv.request('POST', '/v1/orders', { auth: m2.key, headers, body: { amount: 1000 } });
  assert.notEqual(a.json.id, b.json.id);
  assert.equal(b.headers.get('idempotent-replayed'), null);
});

test('rate limit headers and 429 on /v1', async () => {
  const limited = await (await import('./helpers.js')).startTestServer({ rateLimits: { v1: 3 } });
  try {
    const { key } = await signup(limited);
    let last;
    for (let i = 0; i < 4; i++) last = await limited.request('GET', '/v1/orders', { auth: key });
    assert.equal(last.status, 429);
    assert.equal(last.json.error.type, 'rate_limit_error');
    assert.ok(last.headers.get('retry-after'));
    assert.equal(last.headers.get('ratelimit-limit'), '3');
    assert.equal(last.headers.get('ratelimit-remaining'), '0');
  } finally {
    await limited.close();
  }
});
