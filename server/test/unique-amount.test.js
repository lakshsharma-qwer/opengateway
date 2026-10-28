import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, signup } from './helpers.js';
import { run } from '../src/db.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await srv.close(); });

const createOrder = (key, body) => srv.request('POST', '/v1/orders', { auth: key, body });

test('open orders on the same VPA get distinct amount_payable', async () => {
  const { key } = await signup(srv);
  const a = await createOrder(key, { amount: 49900 });
  const b = await createOrder(key, { amount: 49900 });
  const c = await createOrder(key, { amount: 49900 });
  assert.equal(a.status, 201);
  assert.deepEqual([a.json.amount_payable, b.json.amount_payable, c.json.amount_payable], [49900, 49901, 49902]);
  assert.equal(a.json.amount, 49900);
  assert.equal(c.json.amount, 49900);
  // Cancelling does NOT free the slot immediately (previously it did — that let a late SMS for the
  // cancelled order capture the new one). The slot stays held for the late-credit grace window.
  await srv.request('POST', `/v1/orders/${b.json.id}/cancel`, { auth: key });
  const d = await createOrder(key, { amount: 49900 });
  assert.equal(d.json.amount_payable, 49903);
});

test('expired orders keep their slot for the grace window, then free it', async () => {
  const { key } = await signup(srv);
  const a = await createOrder(key, { amount: 10000 });
  const t = Math.floor(Date.now() / 1000);
  run(srv.db, 'UPDATE orders SET expires_at = ? WHERE id = ?', t - 5, a.json.id);
  const b = await createOrder(key, { amount: 10000 });
  assert.equal(b.json.amount_payable, 10001, 'recently expired slot is still held');
  run(srv.db, `UPDATE orders SET status='expired', expires_at = ?, closed_at = ? WHERE id = ?`, t - 3600, t - 3600, a.json.id);
  const c = await createOrder(key, { amount: 10000 });
  assert.equal(c.json.amount_payable, 10000, 'slot is free after the grace window');
});

test('all 100 slots busy -> 409 VPA_BUSY', async () => {
  const { key } = await signup(srv);
  for (let i = 0; i < 100; i++) {
    const r = await createOrder(key, { amount: 20000 });
    assert.equal(r.json.amount_payable, 20000 + i);
  }
  const over = await createOrder(key, { amount: 20000 });
  assert.equal(over.status, 409);
  assert.equal(over.json.error.code, 'VPA_BUSY');
  assert.equal(over.json.error.type, 'conflict_error');
  // A different amount still works.
  const other = await createOrder(key, { amount: 30000 });
  assert.equal(other.status, 201);
});

test('unique_amount=false keeps amount_payable = amount', async () => {
  const { key, cookie } = await signup(srv);
  const s = await srv.request('PATCH', '/api/settings', { cookie, body: { unique_amount: false } });
  assert.equal(s.json.unique_amount, false);
  const a = await createOrder(key, { amount: 49900 });
  const b = await createOrder(key, { amount: 49900 });
  assert.equal(a.json.amount_payable, 49900);
  assert.equal(b.json.amount_payable, 49900);
});

test('order validation and NO_VPA_CONFIGURED', async () => {
  const { key } = await signup(srv, { vpa: null });
  const none = await createOrder(key, { amount: 10000 });
  assert.equal(none.status, 400);
  assert.equal(none.json.error.code, 'NO_VPA_CONFIGURED');
  const { key: k2 } = await signup(srv);
  const small = await createOrder(k2, { amount: 99 });
  assert.equal(small.status, 400);
  assert.equal(small.json.error.code, 'VALIDATION_ERROR');
  assert.equal(small.json.error.field, 'amount');
  const notes = await createOrder(k2, { amount: 1000, notes: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`k${i}`, 'v'])) });
  assert.equal(notes.json.error.field, 'notes');
  const exp = await createOrder(k2, { amount: 1000, expire_in: 60 });
  assert.equal(exp.json.error.field, 'expire_in');
});
