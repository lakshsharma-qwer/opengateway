/** Money correctness: races, UTR reuse, late credits, slot reuse, mode isolation, customer-UTR claims. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, signup } from './helpers.js';
import { all, one, run } from '../src/db.js';
import { runJobsOnce } from '../src/jobs.js';
import { waitForDeliveries } from '../src/lib/webhooks.js';
import { LATE_CREDIT_GRACE_SECONDS } from '../src/lib/orders.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await waitForDeliveries(); await srv.close(); });

const nowS = () => Math.floor(Date.now() / 1000);

async function merchant({ unique = true, live = false } = {}) {
  const m = await signup(srv);
  if (!unique) await srv.request('PATCH', '/api/settings', { cookie: m.cookie, body: { unique_amount: false } });
  const obs = await srv.request('POST', '/api/observers', { cookie: m.cookie, body: { name: 'Phone', mode: 'test' } });
  m.token = obs.json.token;
  if (live) {
    await srv.request('POST', '/api/vpas', { cookie: m.cookie, body: { vpa: `live${Date.now()}@okhdfc`, payee_name: 'Live', mode: 'live' } });
    const k = (await srv.request('POST', '/api/api-keys', { cookie: m.cookie, body: { mode: 'live' } })).json;
    m.liveKey = { key_id: k.key_id, key_secret: k.key_secret };
    m.liveToken = (await srv.request('POST', '/api/observers', { cookie: m.cookie, body: { name: 'Live phone', mode: 'live' } })).json.token;
  }
  return m;
}
const order = async (m, body, key = m.key) => {
  const r = await srv.request('POST', '/v1/orders', { auth: key, body });
  assert.equal(r.status, 201, r.text);
  return r.json;
};
const ingest = (token, text) => srv.request('POST', '/v1/observers/ingest', { headers: { 'X-Observer-Token': token }, body: { text } });
const rupees = (p) => (p / 100).toFixed(2);
const getOrder = (m, id, key = m.key) => srv.request('GET', `/v1/orders/${id}`, { auth: key }).then((r) => r.json);
const captured = (orderId) => all(srv.db, `SELECT * FROM payments WHERE order_id=? AND status='captured'`, orderId);
const events = (orderId, type) => all(srv.db, 'SELECT * FROM events WHERE order_id=? AND type=?', orderId, type);

test('two SMS for the same payment arriving at once capture the order exactly once', async () => {
  const m = await merchant();
  const o = await order(m, { amount: 31400 });
  const [a, b] = await Promise.all([
    ingest(m.token, `Rs.${rupees(o.amount_payable)} credited to A/c XX12 from VPA a@ybl (UPI Ref 600000000001)`),
    ingest(m.token, `Ravi paid you ₹${rupees(o.amount_payable)}`),
  ]);
  const statuses = [a.json.status, b.json.status].sort();
  assert.deepEqual(statuses, ['matched', 'unmatched']);
  assert.equal(captured(o.id).length, 1);
  assert.equal(events(o.id, 'order.paid').length, 1);
});

test('SMS and merchant mark-paid racing: one wins, the other is rejected, single capture', async () => {
  const m = await merchant();
  const o = await order(m, { amount: 31500 });
  const [sms, mark] = await Promise.all([
    ingest(m.token, `Rs.${rupees(o.amount_payable)} credited to A/c XX12 (UPI Ref 600000000002)`),
    srv.request('POST', `/api/orders/${o.id}/mark-paid`, { cookie: m.cookie, body: {} }),
  ]);
  const smsWon = sms.json.status === 'matched';
  assert.equal(mark.status, smsWon ? 409 : 200);
  if (smsWon) assert.equal(mark.json.error.code, 'ORDER_ALREADY_PAID');
  else assert.equal(sms.json.status, 'unmatched');
  assert.equal(captured(o.id).length, 1);
  assert.equal(events(o.id, 'order.paid').length, 1);
});

test('concurrent mark-paid calls: exactly one succeeds', async () => {
  const m = await merchant();
  const o = await order(m, { amount: 31600 });
  const rs = await Promise.all([1, 2, 3].map(() => srv.request('POST', `/api/orders/${o.id}/mark-paid`, { cookie: m.cookie, body: {} })));
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409, 409]);
  assert.equal(captured(o.id).length, 1);
});

test('racing refunds can never exceed the captured amount', async () => {
  const m = await merchant();
  const o = await order(m, { amount: 50000 });
  await srv.request('POST', `/v1/test/orders/${o.id}/simulate`, { auth: m.key, body: { outcome: 'success' } });
  const pay = captured(o.id)[0];
  const rs = await Promise.all(Array.from({ length: 6 }, () => srv.request('POST', '/v1/refunds', { auth: m.key, body: { payment_id: pay.id, amount: 20000 } })));
  assert.equal(rs.filter((r) => r.status === 201).length, 2);
  assert.ok(rs.filter((r) => r.status !== 201).every((r) => r.json.error.code === 'REFUND_AMOUNT_EXCEEDED'));
  const total = one(srv.db, `SELECT SUM(amount) AS s FROM refunds WHERE payment_id=? AND status<>'failed'`, pay.id).s;
  assert.ok(total <= pay.amount);
  // process + fail racing on the same refund: one wins.
  const rf = rs.find((r) => r.status === 201).json;
  const [p, f] = await Promise.all([
    srv.request('POST', `/api/refunds/${rf.id}/process`, { cookie: m.cookie, body: {} }),
    srv.request('POST', `/api/refunds/${rf.id}/fail`, { cookie: m.cookie }),
  ]);
  assert.deepEqual([p.status, f.status].sort(), [200, 400]);
});

test('refund amount validation rejects floats, strings, negatives, zero', async () => {
  const m = await merchant();
  const o = await order(m, { amount: 50000 });
  await srv.request('POST', `/v1/test/orders/${o.id}/simulate`, { auth: m.key, body: { outcome: 'success' } });
  const pay = captured(o.id)[0];
  for (const amount of [100.5, '100', -100, 0, 1e15, true]) {
    const r = await srv.request('POST', '/v1/refunds', { auth: m.key, body: { payment_id: pay.id, amount } });
    assert.equal(r.status, 400, `amount ${amount}`);
    assert.equal(r.json.error.field, 'amount');
  }
});

test('a UTR is consumed once: duplicate SMS / reuse on another order / merchant reuse are rejected', async () => {
  const m = await merchant();
  const a = await order(m, { amount: 32000 });
  const b = await order(m, { amount: 33000 });
  const first = await ingest(m.token, `Rs.${rupees(a.amount_payable)} credited to A/c XX12 (UPI Ref 600000000003)`);
  assert.equal(first.json.status, 'matched');
  // Different SMS, same UTR, amount matching b: duplicate -> never captures b.
  const second = await ingest(m.token, `INR ${rupees(b.amount_payable)} credited to your A/c XX99. UPI Ref No 600000000003`);
  assert.equal(second.json.status, 'duplicate');
  assert.equal((await getOrder(m, b.id)).status, 'created');
  const mark = await srv.request('POST', `/api/orders/${b.id}/mark-paid`, { cookie: m.cookie, body: { utr: '600000000003' } });
  assert.equal(mark.status, 409);
  assert.equal(mark.json.error.code, 'UTR_ALREADY_USED');
  const claim = await srv.request('POST', `/api/checkout/${b.payment_session_id}/confirm`, { body: { utr: '600000000003' } });
  assert.equal(claim.status, 409);
});

test('live mode: a UTR captured for one merchant cannot be captured by another', async () => {
  const m1 = await merchant({ live: true });
  const m2 = await merchant({ live: true });
  const o1 = await order(m1, { amount: 34000 }, m1.liveKey);
  const o2 = await order(m2, { amount: 34000 }, m2.liveKey);
  const r1 = await srv.request('POST', `/api/orders/${o1.id}/mark-paid`, { cookie: m1.cookie, body: { utr: '600000000004' } });
  assert.equal(r1.status, 200);
  const r2 = await srv.request('POST', `/api/orders/${o2.id}/mark-paid`, { cookie: m2.cookie, body: { utr: '600000000004' } });
  assert.equal(r2.status, 409);
  assert.equal(r2.json.error.code, 'UTR_ALREADY_USED');
  // Same SMS forwarded to merchant 2's live observer stays unmatched.
  const s = await ingest(m2.liveToken, `Rs.${rupees(o2.amount_payable)} credited to A/c XX12 (UPI Ref 600000000004)`);
  assert.equal(s.json.status, 'unmatched');
  assert.equal((await getOrder(m2, o2.id, m2.liveKey)).status, 'created');
});

test('late credit: SMS after expiry but within the grace window captures the expired order', async () => {
  const m = await merchant();
  const o = await order(m, { amount: 35000 });
  run(srv.db, 'UPDATE orders SET expires_at=? WHERE id=?', nowS() - 60, o.id);
  await runJobsOnce(srv.db);
  assert.equal((await getOrder(m, o.id)).status, 'expired');
  const s = await ingest(m.token, `Rs.${rupees(o.amount_payable)} credited to A/c XX12 (UPI Ref 600000000005)`);
  assert.equal(s.json.status, 'matched');
  assert.equal(s.json.order_id, o.id);
  const after = await getOrder(m, o.id);
  assert.equal(after.status, 'paid');
  assert.equal(captured(o.id)[0].verified_by, 'observer');
});

test('late credit after the grace window is left unmatched', async () => {
  const m = await merchant();
  const o = await order(m, { amount: 35100 });
  const old = nowS() - LATE_CREDIT_GRACE_SECONDS - 60;
  run(srv.db, `UPDATE orders SET status='expired', expires_at=?, closed_at=? WHERE id=?`, old, old, o.id);
  const s = await ingest(m.token, `Rs.${rupees(o.amount_payable)} credited to A/c XX12 (UPI Ref 600000000006)`);
  assert.equal(s.json.status, 'unmatched');
  assert.equal((await getOrder(m, o.id)).status, 'expired');
});

test('slot reuse: a late SMS for an expired order never pays the new order that followed it', async () => {
  const m = await merchant();
  const a = await order(m, { amount: 36000 });
  run(srv.db, 'UPDATE orders SET expires_at=? WHERE id=?', nowS() - 30, a.id);
  await runJobsOnce(srv.db);
  const b = await order(m, { amount: 36000 });
  assert.notEqual(b.amount_payable, a.amount_payable, 'expired order still holds its slot');
  const s = await ingest(m.token, `Rs.${rupees(a.amount_payable)} credited to A/c XX12 (UPI Ref 600000000007)`);
  assert.equal(s.json.order_id, a.id);
  assert.equal((await getOrder(m, b.id)).status, 'created');
});

test('slot reuse: customer cancels after paying -> late SMS is not attributed to a new order; merchant can attach', async () => {
  const m = await merchant();
  const a = await order(m, { amount: 37000 });
  await srv.request('POST', `/api/checkout/${a.payment_session_id}/cancel`);
  const b = await order(m, { amount: 37000 });
  assert.notEqual(b.amount_payable, a.amount_payable);
  const s = await ingest(m.token, `Rs.${rupees(a.amount_payable)} credited to A/c XX12 (UPI Ref 600000000008)`);
  assert.equal(s.json.status, 'unmatched');
  assert.equal((await getOrder(m, b.id)).status, 'created');
  const att = await srv.request('POST', `/api/observations/${s.json.observation_id}/attach`, { cookie: m.cookie, body: { order_id: a.id } });
  assert.equal(att.status, 200, att.text);
  assert.equal(att.json.order.status, 'paid');
});

test('unique_amount=false: a second notification for a just-paid order is not attributed to a new same-amount order', async () => {
  const m = await merchant({ unique: false });
  const a = await order(m, { amount: 38000 });
  const s1 = await ingest(m.token, `Rs.${rupees(a.amount_payable)} credited to A/c XX12 (UPI Ref 600000000009)`);
  assert.equal(s1.json.status, 'matched');
  const b = await order(m, { amount: 38000 });
  assert.equal(b.amount_payable, a.amount_payable);
  const s2 = await ingest(m.token, `Ravi paid you ₹${rupees(a.amount_payable)}`);
  assert.equal(s2.json.status, 'unmatched');
  assert.equal((await getOrder(m, b.id)).status, 'created');
});

test('mode isolation: test observer never captures live orders and vice versa', async () => {
  const m = await merchant({ live: true });
  const live = await order(m, { amount: 39000 }, m.liveKey);
  const s = await ingest(m.token, `Rs.${rupees(live.amount_payable)} credited to A/c XX12 (UPI Ref 600000000010)`);
  assert.equal(s.json.status, 'unmatched');
  assert.equal((await getOrder(m, live.id, m.liveKey)).status, 'created');
  const t = await order(m, { amount: 39100 });
  const s2 = await ingest(m.liveToken, `Rs.${rupees(t.amount_payable)} credited to A/c XX12 (UPI Ref 600000000011)`);
  assert.equal(s2.json.status, 'unmatched');
  assert.equal((await getOrder(m, t.id)).status, 'created');
  // And a merchant cannot attach a test observation to a live order.
  const att = await srv.request('POST', `/api/observations/${s.json.observation_id}/attach`, { cookie: m.cookie, body: { order_id: live.id } });
  assert.equal(att.status, 404);
});

test('a customer-supplied UTR alone never marks an order paid', async () => {
  const m = await merchant();
  const o = await order(m, { amount: 40000 });
  const c = await srv.request('POST', `/api/checkout/${o.payment_session_id}/confirm`, { body: { utr: '600000000012' } });
  assert.equal(c.status, 200);
  assert.equal(c.json.status, 'attempted');
  assert.equal(c.json.payment.status, 'pending_verification');
  const st = await srv.request('GET', `/api/checkout/${o.payment_session_id}/status`);
  assert.equal(st.json.order_status, 'attempted');
  assert.equal(st.json.redirect_url, null);
  assert.equal(captured(o.id).length, 0);
});

test('UTR claim cannot redirect a small credit to a big order (ingest and confirm paths)', async () => {
  const m = await merchant();
  // Ingest path: customer claims UTR U on a ₹500 order, then a ₹1 credit with UTR U arrives.
  const big = await order(m, { amount: 50000 });
  await srv.request('POST', `/api/checkout/${big.payment_session_id}/confirm`, { body: { utr: '600000000013' } });
  const small = await ingest(m.token, 'Rs.1.00 credited to A/c XX12 (UPI Ref 600000000013)');
  assert.equal(small.json.status, 'unmatched');
  assert.equal((await getOrder(m, big.id)).status, 'attempted');
  // Confirm path: a ₹2 credit with UTR V is already unmatched; the customer claims V on a ₹600 order.
  const big2 = await order(m, { amount: 60000 });
  run(srv.db, 'UPDATE orders SET created_at=created_at-10 WHERE id=?', big2.id);
  const s = await ingest(m.token, 'Rs.2.00 credited to A/c XX12 (UPI Ref 600000000014)');
  assert.equal(s.json.status, 'unmatched');
  const c = await srv.request('POST', `/api/checkout/${big2.payment_session_id}/confirm`, { body: { utr: '600000000014' } });
  assert.equal(c.json.status, 'attempted');
  assert.equal(captured(big2.id).length, 0);
});

test('UTR claim + matching credit amount does capture (disambiguation is still useful)', async () => {
  const m = await merchant({ unique: false });
  const a = await order(m, { amount: 41000 });
  const b = await order(m, { amount: 41000 });
  await srv.request('POST', `/api/checkout/${b.payment_session_id}/confirm`, { body: { utr: '600000000015' } });
  const s = await ingest(m.token, 'Rs.410.00 credited to A/c XX12 (UPI Ref 600000000015)');
  assert.equal(s.json.status, 'matched');
  assert.equal(s.json.order_id, b.id);
  assert.equal((await getOrder(m, a.id)).status, 'created');
});

test('expiry sweeper is idempotent', async () => {
  const m = await merchant();
  const o = await order(m, { amount: 42000 });
  await srv.request('POST', `/api/checkout/${o.payment_session_id}/attempt`, { body: { flow: 'qr' } });
  run(srv.db, 'UPDATE orders SET expires_at=? WHERE id=?', nowS() - 5, o.id);
  await Promise.all([runJobsOnce(srv.db), runJobsOnce(srv.db)]);
  await runJobsOnce(srv.db);
  assert.equal(events(o.id, 'order.expired').length, 1);
  assert.equal(events(o.id, 'payment.failed').length, 1);
  assert.equal((await getOrder(m, o.id)).status, 'expired');
});

test('cancelling a payment link cancels its open checkout order', async () => {
  const m = await merchant();
  const link = (await srv.request('POST', '/v1/payment_links', { auth: m.key, body: { amount: 43000 } })).json;
  const code = link.short_url.split('/').pop();
  await srv.request('GET', `/l/${code}`);
  const lk = (await srv.request('GET', `/v1/payment_links/${link.id}`, { auth: m.key })).json;
  const c = await srv.request('POST', `/v1/payment_links/${link.id}/cancel`, { auth: m.key });
  assert.equal(c.json.status, 'cancelled');
  assert.equal((await getOrder(m, lk.order_id)).status, 'cancelled');
});

test('simulator UTRs do not collide when simulating many orders quickly', async () => {
  const m = await merchant();
  const os = await Promise.all(Array.from({ length: 8 }, (_, i) => order(m, { amount: 44000 + i })));
  const rs = await Promise.all(os.map((o) => srv.request('POST', `/v1/test/orders/${o.id}/simulate`, { auth: m.key, body: { outcome: 'success' } })));
  assert.ok(rs.every((r) => r.json.status === 'paid'), rs.map((r) => r.text).join('\n'));
});
