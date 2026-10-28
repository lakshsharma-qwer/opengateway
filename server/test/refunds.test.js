import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, signup } from './helpers.js';
import { waitForDeliveries } from '../src/lib/webhooks.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await waitForDeliveries(); await srv.close(); });

async function paidPayment(m, amount = 50000) {
  const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount } })).json;
  await srv.request('POST', `/v1/test/orders/${o.id}/simulate`, { auth: m.key, body: { outcome: 'success' } });
  return (await srv.request('GET', `/v1/orders/${o.id}/payments`, { auth: m.key })).json.items[0];
}

test('refund validation: over-limit, partial, default remaining, processed', async () => {
  const m = await signup(srv);
  const p = await paidPayment(m);
  assert.equal(p.status, 'captured');

  const over = await srv.request('POST', '/v1/refunds', { auth: m.key, body: { payment_id: p.id, amount: p.amount + 1 } });
  assert.equal(over.status, 400);
  assert.equal(over.json.error.code, 'REFUND_AMOUNT_EXCEEDED');

  const r1 = await srv.request('POST', '/v1/refunds', { auth: m.key, body: { payment_id: p.id, amount: 20000, notes: { reason: 'size' } } });
  assert.equal(r1.status, 201);
  assert.equal(r1.json.status, 'pending');
  assert.equal(r1.json.entity, 'refund');

  const over2 = await srv.request('POST', '/v1/refunds', { auth: m.key, body: { payment_id: p.id, amount: p.amount - 20000 + 1 } });
  assert.equal(over2.json.error.code, 'REFUND_AMOUNT_EXCEEDED');

  // Failed refunds free up the balance.
  const failed = await srv.request('POST', `/api/refunds/${r1.json.id}/fail`, { cookie: m.cookie });
  assert.equal(failed.json.status, 'failed');

  const rest = await srv.request('POST', '/v1/refunds', { auth: m.key, body: { payment_id: p.id } });
  assert.equal(rest.json.amount, p.amount);

  const none = await srv.request('POST', '/v1/refunds', { auth: m.key, body: { payment_id: p.id, amount: 100 } });
  assert.equal(none.json.error.code, 'REFUND_AMOUNT_EXCEEDED');

  const proc = await srv.request('POST', `/api/refunds/${rest.json.id}/process`, { cookie: m.cookie, body: { utr: '998877665544' } });
  assert.equal(proc.json.status, 'processed');
  assert.equal(proc.json.utr, '998877665544');
  assert.ok(proc.json.processed_at);
});

test('refund requires a captured payment', async () => {
  const m = await signup(srv);
  const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 1000 } })).json;
  const att = await srv.request('POST', `/api/checkout/${o.payment_session_id}/attempt`, { body: { flow: 'qr' } });
  const r = await srv.request('POST', '/v1/refunds', { auth: m.key, body: { payment_id: att.json.id } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'PAYMENT_NOT_CAPTURED');
  const nf = await srv.request('POST', '/v1/refunds', { auth: m.key, body: { payment_id: 'pay_nope' } });
  assert.equal(nf.status, 404);
});
