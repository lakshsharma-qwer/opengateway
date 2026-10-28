import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startTestServer, signup, startWebhookReceiver } from './helpers.js';
import { verifyWebhookSignature, waitForDeliveries } from '../src/lib/webhooks.js';
import { run } from '../src/db.js';

let srv, hook;
before(async () => { srv = await startTestServer(); hook = await startWebhookReceiver(); });
after(async () => { await waitForDeliveries(); await srv.close(); await hook.close(); });

async function setupMerchant() {
  const m = await signup(srv);
  const obs = await srv.request('POST', '/api/observers', { cookie: m.cookie, body: { name: 'Pixel', mode: 'test' } });
  assert.equal(obs.status, 201);
  assert.match(obs.json.ingest_url, /\/v1\/observers\/ingest\?token=/);
  const wh = await srv.request('POST', '/api/webhooks', { cookie: m.cookie, body: { url: hook.url, events: ['*'], mode: 'test' } });
  assert.equal(wh.status, 201);
  assert.match(wh.json.secret, /^whsec_/);
  return { ...m, observerToken: obs.json.token, webhook: wh.json };
}

test('order -> checkout -> attempt -> confirm -> SMS ingest -> paid -> webhook', async () => {
  const m = await setupMerchant();
  const created = await srv.request('POST', '/v1/orders', {
    auth: m.key,
    body: { amount: 49900, receipt: 'rcpt_1', notes: { sku: 'tee' }, customer: { name: 'Asha', email: 'asha@example.com', phone: '9999999999' }, return_url: 'https://shop.example/return' },
  });
  assert.equal(created.status, 201);
  const order = created.json;
  assert.equal(order.entity, 'order');
  assert.equal(order.status, 'created');
  assert.match(order.id, /^order_[0-9A-Za-z]{14}$/);
  assert.match(order.payment_session_id, /^ps_[0-9A-Za-z]{24}$/);
  assert.equal(order.checkout_url, `http://localhost:5173/pay/${order.payment_session_id}`);
  assert.equal(order.vpa, 'shop@okaxis');

  const ps = order.payment_session_id;
  const co = await srv.request('GET', `/api/checkout/${ps}`);
  assert.equal(co.status, 200);
  assert.equal(co.json.order.amount_payable, 49900);
  assert.equal(co.json.merchant.name, 'Test Shop');
  assert.equal(co.json.upi.uri, `upi://pay?pa=shop@okaxis&pn=Test%20Shop&am=499.00&cu=INR&tn=${order.id}&tr=${order.id}`);
  assert.equal(co.json.payment, null);
  assert.equal(co.json.mode, 'test');

  const att = await srv.request('POST', `/api/checkout/${ps}/attempt`, { body: { flow: 'intent', upi_app: 'phonepe' } });
  assert.equal(att.status, 200);
  assert.equal(att.json.status, 'created');
  assert.equal(att.json.upi_app, 'phonepe');
  const again = await srv.request('POST', `/api/checkout/${ps}/attempt`, { body: { flow: 'qr' } });
  assert.equal(again.json.id, att.json.id, 'returns the existing open payment');

  const badUtr = await srv.request('POST', `/api/checkout/${ps}/confirm`, { body: { utr: '123' } });
  assert.equal(badUtr.status, 400);

  const conf = await srv.request('POST', `/api/checkout/${ps}/confirm`, { body: { utr: '412345678901' } });
  assert.equal(conf.status, 200);
  assert.equal(conf.json.payment.status, 'pending_verification');
  assert.equal(conf.json.status, 'attempted');

  const st1 = await srv.request('GET', `/api/checkout/${ps}/status`);
  assert.equal(st1.json.order_status, 'attempted');
  assert.equal(st1.json.payment_status, 'pending_verification');
  assert.equal(st1.json.redirect_url, null);

  // Bank SMS arrives through the forwarder (form-encoded, token in query).
  const sms = 'Money Received - INR 499.00 in your HDFC Bank A/c xx1234 on 23-10-26 by A/c linked to VPA asha@okicici (UPI Ref No 412345678901). Avl bal: INR 9,999.00';
  const ing = await srv.request('POST', `/v1/observers/ingest?token=${encodeURIComponent(m.observerToken)}`, {
    raw: new URLSearchParams({ message: sms, from: 'VM-HDFCBK' }).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(ing.status, 200);
  assert.equal(ing.json.ok, true);
  assert.equal(ing.json.status, 'matched');
  assert.equal(ing.json.order_id, order.id);

  const after = await srv.request('GET', `/v1/orders/${order.id}`, { auth: m.key });
  assert.equal(after.json.status, 'paid');
  assert.equal(after.json.amount_paid, 49900);
  assert.equal(after.json.utr, '412345678901');

  const pays = await srv.request('GET', `/v1/orders/${order.id}/payments`, { auth: m.key });
  assert.equal(pays.json.entity, 'collection');
  const p = pays.json.items[0];
  assert.equal(p.status, 'captured');
  assert.equal(p.verified_by, 'observer');
  assert.equal(p.payer_vpa, 'asha@okicici');
  assert.equal(p.observation_id, ing.json.observation_id);

  // Status gives a signed redirect.
  const st2 = await srv.request('GET', `/api/checkout/${ps}/status`);
  assert.equal(st2.json.order_status, 'paid');
  const ru = new URL(st2.json.redirect_url);
  assert.equal(ru.origin + ru.pathname, 'https://shop.example/return');
  assert.equal(ru.searchParams.get('og_status'), 'paid');
  assert.equal(ru.searchParams.get('og_payment_id'), p.id);
  const expected = crypto.createHmac('sha256', m.key.key_secret).update(`${order.id}|${p.id}`).digest('hex');
  assert.equal(ru.searchParams.get('og_signature'), expected);

  // Duplicate SMS is deduped.
  const dup = await srv.request('POST', '/v1/observers/ingest', { headers: { 'X-Observer-Token': m.observerToken }, body: { text: sms } });
  assert.equal(dup.json.status, 'duplicate');

  // Webhooks delivered and correctly signed.
  await waitForDeliveries();
  const paid = hook.received.find((r) => r.body.type === 'order.paid' && r.body.data.order.id === order.id);
  assert.ok(paid, 'order.paid webhook received');
  assert.equal(paid.headers['x-opengateway-event'], 'order.paid');
  assert.equal(paid.headers['user-agent'], 'OpenGateway-Webhooks/1.0');
  assert.match(paid.headers['x-opengateway-delivery-id'], /^whd_/);
  assert.ok(verifyWebhookSignature(m.webhook.secret, paid.headers['x-opengateway-signature'], paid.raw));
  assert.ok(!verifyWebhookSignature('whsec_wrong', paid.headers['x-opengateway-signature'], paid.raw));
  const types = hook.received.filter((r) => r.body.data?.order?.id === order.id || r.body.data?.payment?.order_id === order.id).map((r) => r.body.type);
  for (const t of ['payment.pending_verification', 'payment.captured', 'order.paid']) assert.ok(types.includes(t), `missing ${t}`);

  // Dashboard detail shows everything.
  const detail = await srv.request('GET', `/api/orders/${order.id}`, { cookie: m.cookie });
  assert.equal(detail.json.order.status, 'paid');
  assert.equal(detail.json.observations.length, 1);
  assert.ok(detail.json.events.length >= 3);
});

test('amount-only match, debit ignored, unmatched when ambiguous', async () => {
  const m = await setupMerchant();
  const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 15000 } })).json;
  const ingest = (text) => srv.request('POST', '/v1/observers/ingest', { headers: { 'X-Observer-Token': m.observerToken, 'Content-Type': 'text/plain' }, raw: text });

  const debit = await ingest('Sent Rs.150.00 from Kotak Bank AC X1234 to x@okaxis on 23-10-26.UPI Ref 912345678001.');
  assert.equal(debit.json.status, 'ignored');

  const wrongAmt = await ingest('Received Rs.151.00 in your Kotak Bank AC X1234 from y@okaxis on 23-10-26.UPI Ref:912345678002.');
  assert.equal(wrongAmt.json.status, 'unmatched');

  const ok = await ingest('Received Rs.150.00 in your Kotak Bank AC X1234 from y@okaxis on 23-10-26.UPI Ref:912345678003.');
  assert.equal(ok.json.status, 'matched');
  assert.equal(ok.json.order_id, o.id);

  const bad = await srv.request('POST', '/v1/observers/ingest?token=nope', { body: { text: 'x' } });
  assert.equal(bad.status, 401);
});

test('confirm + customer UTR settles an ambiguous credit observed after the order', async () => {
  // Previously this test created the credit BEFORE the order and expected "I have paid" to capture it.
  // That was a bug: any stray credit of the same amount (or a credit for an older order) could pay a new
  // order on the customer's word. A credit must be observed after the order exists.
  const m = await setupMerchant();
  await srv.request('PATCH', '/api/settings', { cookie: m.cookie, body: { unique_amount: false } });
  const o1 = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 77700 } })).json;
  const o2 = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 77700 } })).json;
  assert.equal(o1.amount_payable, o2.amount_payable);
  run(srv.db, 'UPDATE orders SET created_at = created_at - 5 WHERE id IN (?, ?)', o1.id, o2.id);
  // Two open orders share the amount -> the credit is ambiguous -> unmatched.
  const ing = await srv.request('POST', '/v1/observers/ingest', { headers: { 'X-Observer-Token': m.observerToken },
    body: { text: 'Rs.777.00 credited to HDFC Bank A/c XX1234 on 23-10-26 from VPA z@ybl (UPI 523456789777)' } });
  assert.equal(ing.json.status, 'unmatched');
  // The customer of o2 confirms with the UTR from their app -> disambiguates the real observed credit.
  const conf = await srv.request('POST', `/api/checkout/${o2.payment_session_id}/confirm`, { body: { utr: '523456789777' } });
  assert.equal(conf.json.status, 'paid');
  assert.equal(conf.json.payment.status, 'captured');
  assert.equal(conf.json.payment.verified_by, 'observer');
  assert.equal(conf.json.payment.utr, '523456789777');
  const first = (await srv.request('GET', `/v1/orders/${o1.id}`, { auth: m.key })).json;
  assert.equal(first.status, 'created');
});

test('confirm never captures with a credit that arrived before the order existed', async () => {
  const m = await setupMerchant();
  const ing = await srv.request('POST', '/v1/observers/ingest', { headers: { 'X-Observer-Token': m.observerToken },
    body: { text: 'Rs.778.00 credited to HDFC Bank A/c XX1234 on 23-10-26 from VPA z@ybl (UPI 523456789778)' } });
  assert.equal(ing.json.status, 'unmatched');
  run(srv.db, 'UPDATE observations SET created_at = created_at - 10 WHERE id = ?', ing.json.observation_id);
  const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 77800 } })).json;
  const conf = await srv.request('POST', `/api/checkout/${o.payment_session_id}/confirm`, { body: {} });
  assert.equal(conf.json.status, 'attempted');
  assert.equal(conf.json.payment.status, 'pending_verification');
  const withUtr = await srv.request('POST', `/api/checkout/${o.payment_session_id}/confirm`, { body: { utr: '523456789778' } });
  assert.equal(withUtr.json.status, 'attempted', 'claiming the old credit\'s UTR does not capture either');
});

test('checkout cancel, simulate and merchant actions', async () => {
  const m = await setupMerchant();
  const mk = async (body = {}) => (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 10000, return_url: 'https://shop.example/r', ...body } })).json;

  const a = await mk();
  const c = await srv.request('POST', `/api/checkout/${a.payment_session_id}/cancel`);
  assert.equal(c.json.order_status, 'cancelled');
  assert.match(c.json.redirect_url, /og_status=cancelled/);
  const notPayable = await srv.request('POST', `/api/checkout/${a.payment_session_id}/attempt`, { body: { flow: 'qr' } });
  assert.equal(notPayable.json.error.code, 'ORDER_NOT_PAYABLE');

  const b = await mk();
  const sim = await srv.request('POST', `/v1/test/orders/${b.id}/simulate`, { auth: m.key, body: { outcome: 'success' } });
  assert.equal(sim.json.status, 'paid');

  const d = await mk();
  const simF = await srv.request('POST', `/api/checkout/${d.payment_session_id}/simulate`, { body: { outcome: 'failure' } });
  assert.equal(simF.json.payment.status, 'failed');
  const st = await srv.request('GET', `/api/checkout/${d.payment_session_id}/status`);
  assert.match(st.json.redirect_url, /og_status=failed/);

  const e = await mk();
  await srv.request('POST', `/api/checkout/${e.payment_session_id}/confirm`, { body: { utr: '111122223333' } });
  const pay = (await srv.request('GET', `/v1/orders/${e.id}/payments`, { auth: m.key })).json.items[0];
  const rej = await srv.request('POST', `/api/payments/${pay.id}/reject`, { cookie: m.cookie, body: { reason: 'No credit seen' } });
  assert.equal(rej.json.status, 'failed');
  assert.equal(rej.json.error_code, 'MERCHANT_REJECTED');
  const mp = await srv.request('POST', `/api/orders/${e.id}/mark-paid`, { cookie: m.cookie, body: { utr: '111122223334' } });
  assert.equal(mp.json.status, 'paid');
  const paidPay = (await srv.request('GET', `/v1/orders/${e.id}/payments`, { auth: m.key })).json.items.find((x) => x.status === 'captured');
  assert.equal(paidPay.verified_by, 'merchant');

  const cancelPaid = await srv.request('POST', `/v1/orders/${e.id}/cancel`, { auth: m.key });
  assert.equal(cancelPaid.json.error.code, 'ORDER_NOT_CANCELLABLE');
});

test('payment link redirect creates an order and link becomes paid', async () => {
  const m = await setupMerchant();
  const link = await srv.request('POST', '/v1/payment_links', { auth: m.key, body: { amount: 25000, description: 'Consultation' } });
  assert.equal(link.status, 201);
  assert.match(link.json.short_url, /^http:\/\/localhost:5173\/l\/[0-9A-Za-z]{7}$/);
  const code = link.json.short_url.split('/').pop();
  const r1 = await srv.request('GET', `/l/${code}`);
  assert.equal(r1.status, 302);
  assert.match(r1.headers.get('location'), /\/pay\/ps_/);
  const r2 = await srv.request('GET', `/l/${code}`);
  assert.equal(r2.headers.get('location'), r1.headers.get('location'), 'reuses the open order');
  const lk = (await srv.request('GET', `/v1/payment_links/${link.json.id}`, { auth: m.key })).json;
  const order = (await srv.request('GET', `/v1/orders/${lk.order_id}`, { auth: m.key })).json;
  assert.equal(order.payment_link_id, link.json.id);
  assert.equal(order.return_url, `http://localhost:5173/l/${code}/done`);
  assert.equal(order.description, 'Consultation');
  await srv.request('POST', `/v1/test/orders/${order.id}/simulate`, { auth: m.key, body: { outcome: 'success' } });
  const lk2 = (await srv.request('GET', `/v1/payment_links/${link.json.id}`, { auth: m.key })).json;
  assert.equal(lk2.status, 'paid');
  const pub = await srv.request('GET', `/api/public/links/${code}`);
  assert.equal(pub.json.status, 'paid');
  assert.equal(pub.json.merchant.name, 'Test Shop');
  const r3 = await srv.request('GET', `/l/${code}`);
  assert.equal(r3.headers.get('location'), `http://localhost:5173/link-status/${code}`);
  const done = await srv.request('GET', `/l/${code}/done?og_status=paid`);
  assert.equal(done.headers.get('location'), `http://localhost:5173/link-status/${code}?og_status=paid`);
});

test('dashboard summary + CSV export + api logs', async () => {
  const m = await setupMerchant();
  const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 10000 } })).json;
  await srv.request('POST', `/v1/test/orders/${o.id}/simulate`, { auth: m.key, body: { outcome: 'success' } });
  const s = await srv.request('GET', '/api/dashboard/summary?mode=test&range=7d', { cookie: m.cookie });
  assert.equal(s.status, 200);
  assert.equal(s.json.collected_amount, 10000);
  assert.equal(s.json.paid_count, 1);
  assert.equal(s.json.series.length, 7);
  assert.equal(s.json.success_rate, 100);
  assert.equal(s.json.recent_orders[0].id, o.id);
  const csv = await srv.request('GET', '/api/reports/export?mode=test&type=orders', { cookie: m.cookie });
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.text, new RegExp(o.id));
  const logs = await srv.request('GET', '/api/api-logs?mode=test', { cookie: m.cookie });
  assert.ok(logs.json.items.some((l) => l.path === '/v1/orders' && l.method === 'POST' && l.status === 201 && l.key_id === m.key.key_id));
});
