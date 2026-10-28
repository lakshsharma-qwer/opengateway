/** Input validation, pagination bounds, error envelopes and cross-merchant isolation (IDOR). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, signup, startWebhookReceiver } from './helpers.js';
import { one, run } from '../src/db.js';
import { waitForDeliveries } from '../src/lib/webhooks.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await waitForDeliveries(); await srv.close(); });

const isEnvelope = (j) => j && j.error && typeof j.error.code === 'string' && typeof j.error.message === 'string' && 'field' in j.error;

test('order amount validation: non-integers, strings, negatives, huge, floats', async () => {
  const m = await signup(srv);
  for (const amount of ['49900', 100.5, -100, 0, 99, 10_000_001, 1e300, true, null, [], {}, '1e5']) {
    const r = await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount } });
    assert.equal(r.status, 400, `amount ${JSON.stringify(amount)}`);
    assert.equal(r.json.error.field, 'amount');
  }
  const ok = await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 10_000_000 } });
  assert.equal(ok.status, 201);
  const dash = await srv.request('POST', '/api/orders', { cookie: m.cookie, body: { amount: 12.5 } });
  assert.equal(dash.json.error.field, 'amount');
  const link = await srv.request('POST', '/v1/payment_links', { auth: m.key, body: { amount: '500' } });
  assert.equal(link.json.error.field, 'amount');
});

test('notes / customer / receipt / expire_in limits', async () => {
  const m = await signup(srv);
  const bad = [
    [{ notes: { k: 'x'.repeat(513) } }, 'notes'],
    [{ notes: { ['k'.repeat(65)]: 'v' } }, 'notes'],
    [{ notes: { k: { nested: true } } }, 'notes'],
    [{ notes: ['a'] }, 'notes'],
    [{ notes: 'str' }, 'notes'],
    [{ customer: { name: 'x'.repeat(101) } }, 'customer.name'],
    [{ customer: { email: 'not-an-email' } }, 'customer.email'],
    [{ customer: { phone: { a: 1 } } }, 'customer.phone'],
    [{ customer: { phone: '<script>' } }, 'customer.phone'],
    [{ customer: 'x' }, 'customer'],
    [{ receipt: 'r'.repeat(41) }, 'receipt'],
    [{ receipt: 123 }, 'receipt'],
    [{ expire_in: 1e20 }, 'expire_in'],
    [{ expire_in: 100000 }, 'expire_in'],
    [{ currency: 'USD' }, 'currency'],
  ];
  for (const [extra, field] of bad) {
    const r = await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 1000, ...extra } });
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.equal(r.json.error.field, field, JSON.stringify(extra));
  }
});

test('return_url / logo_url / website accept only http(s); brand_color is strict hex', async () => {
  const m = await signup(srv);
  for (const return_url of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://x.example/', '//evil.example', 'https://user:pw@evil.example/']) {
    const r = await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 1000, return_url } });
    assert.equal(r.status, 400, return_url);
    assert.equal(r.json.error.field, 'return_url');
  }
  for (const logo_url of ['javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', 'vbscript:x']) {
    const r = await srv.request('PATCH', '/api/settings', { cookie: m.cookie, body: { logo_url } });
    assert.equal(r.status, 400, logo_url);
  }
  for (const brand_color of ['red', '#12345', '#1234567', '#fff;}body{display:none', 'expression(alert(1))', 123]) {
    const r = await srv.request('PATCH', '/api/settings', { cookie: m.cookie, body: { brand_color } });
    assert.equal(r.status, 400, String(brand_color));
  }
  const ok = await srv.request('PATCH', '/api/settings', { cookie: m.cookie, body: { brand_color: '#fff', logo_url: 'https://cdn.example/logo.png' } });
  assert.equal(ok.status, 200);
  const ph = await srv.request('PATCH', '/api/settings', { cookie: m.cookie, body: { support_phone: '<img src=x>' } });
  assert.equal(ph.status, 400);
  // Legacy rows written before validation existed are neutralised on output.
  run(srv.db, `UPDATE merchants SET logo_url='javascript:alert(1)', brand_color='red;}' WHERE id=?`, m.merchant.id);
  const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 1000 } })).json;
  const co = await srv.request('GET', `/api/checkout/${o.payment_session_id}`);
  assert.equal(co.json.merchant.logo_url, null);
  assert.equal(co.json.merchant.brand_color, '#5f259f');
});

test('pagination bounds return 400, never 500', async () => {
  const m = await signup(srv);
  for (const qs of ['count=0', 'count=101', 'count=abc', 'skip=-1', 'skip=99999999999999999999', 'from=1e5', 'count=5&count=6', 'to=-3']) {
    const v1 = await srv.request('GET', `/v1/orders?${qs}`, { auth: m.key });
    assert.equal(v1.status, 400, qs);
    assert.ok(isEnvelope(v1.json), qs);
    const dash = await srv.request('GET', `/api/orders?${qs}`, { cookie: m.cookie });
    assert.equal(dash.status, 400, qs);
  }
  const ok = await srv.request('GET', '/v1/orders?count=100&skip=1000000', { auth: m.key });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.count, 0);
  const badMode = await srv.request('GET', '/api/orders?mode=prod', { cookie: m.cookie });
  assert.equal(badMode.status, 400);
});

test('malformed JSON and oversized bodies get the error envelope, not a stack trace', async () => {
  const m = await signup(srv);
  const targets = [
    ['/v1/orders', { auth: m.key }],
    ['/api/orders', { cookie: m.cookie }],
    ['/api/auth/login', {}],
    ['/api/checkout/ps_aaaaaaaaaaaaaaaaaaaaaaaa/confirm', {}],
  ];
  for (const [url, opts] of targets) {
    const r = await srv.request('POST', url, { ...opts, raw: '{"amount": 10,', headers: { 'Content-Type': 'application/json' } });
    assert.equal(r.status, 400, url);
    assert.ok(isEnvelope(r.json), url);
    assert.doesNotMatch(r.text, /at \w+ \(|node_modules|SyntaxError/);
  }
  const big = await srv.request('POST', '/v1/orders', { auth: m.key, raw: JSON.stringify({ amount: 1000, receipt: 'x'.repeat(300_000) }), headers: { 'Content-Type': 'application/json' } });
  assert.equal(big.status, 413);
  assert.equal(big.json.error.code, 'PAYLOAD_TOO_LARGE');
  const ingestBig = await srv.request('POST', '/v1/observers/ingest?token=x', { raw: 'x'.repeat(100_000), headers: { 'Content-Type': 'text/plain' } });
  assert.ok([401, 413].includes(ingestBig.status));
  assert.ok(isEnvelope(ingestBig.json));
});

test('IDOR: another merchant cannot read or modify any of my objects', async () => {
  const a = await signup(srv);
  const b = await signup(srv);
  const hook = await startWebhookReceiver();
  try {
    // Merchant A's objects.
    const o = (await srv.request('POST', '/v1/orders', { auth: a.key, body: { amount: 50000 } })).json;
    await srv.request('POST', `/v1/test/orders/${o.id}/simulate`, { auth: a.key, body: { outcome: 'success' } });
    const pay = (await srv.request('GET', `/v1/orders/${o.id}/payments`, { auth: a.key })).json.items[0];
    const rf = (await srv.request('POST', '/v1/refunds', { auth: a.key, body: { payment_id: pay.id, amount: 100 } })).json;
    const open = (await srv.request('POST', '/v1/orders', { auth: a.key, body: { amount: 51000 } })).json;
    const link = (await srv.request('POST', '/v1/payment_links', { auth: a.key, body: { amount: 52000 } })).json;
    const wh = (await srv.request('POST', '/api/webhooks', { cookie: a.cookie, body: { url: hook.url } })).json;
    const ping = (await srv.request('POST', `/api/webhooks/${wh.id}/test`, { cookie: a.cookie })).json;
    const obs = (await srv.request('POST', '/api/observers', { cookie: a.cookie, body: { name: 'A phone' } })).json;
    const ing = (await srv.request('POST', '/v1/observers/ingest', { headers: { 'X-Observer-Token': obs.token }, body: { text: 'Rs 999.99 credited to a/c XX1 UPI Ref 700000000001' } })).json;
    const vpa = (await srv.request('GET', '/api/vpas', { cookie: a.cookie })).json.items[0];
    const member = (await srv.request('POST', '/api/team', { cookie: a.cookie, body: { name: 'Dev', email: `dev-${Date.now()}@example.com`, role: 'developer', password: 'password123' } })).json;
    const key = (await srv.request('GET', '/api/api-keys', { cookie: a.cookie })).json.items[0];
    const evt = (await srv.request('GET', '/api/events', { cookie: a.cookie })).json.items[0];

    const B = { cookie: b.cookie };
    const dash = [
      ['GET', `/api/orders/${o.id}`], ['POST', `/api/orders/${open.id}/mark-paid`, {}], ['POST', `/api/orders/${open.id}/cancel`],
      ['GET', `/api/payments/${pay.id}`], ['POST', `/api/payments/${pay.id}/reject`, {}],
      ['POST', '/api/refunds', { payment_id: pay.id, amount: 100 }], ['POST', `/api/refunds/${rf.id}/process`, {}], ['POST', `/api/refunds/${rf.id}/fail`],
      ['GET', `/api/payment-links/${link.id}`], ['POST', `/api/payment-links/${link.id}/cancel`],
      ['GET', `/api/webhooks/${wh.id}`], ['PATCH', `/api/webhooks/${wh.id}`, { url: 'https://evil.example/' }], ['DELETE', `/api/webhooks/${wh.id}`],
      ['POST', `/api/webhooks/${wh.id}/reveal-secret`], ['POST', `/api/webhooks/${wh.id}/test`], ['GET', `/api/webhooks/${wh.id}/deliveries`],
      ['POST', `/api/webhook-deliveries/${ping.id}/resend`],
      ['DELETE', `/api/observers/${obs.id}`], ['POST', `/api/observers/${obs.id}/rotate-token`],
      ['POST', `/api/observations/${ing.observation_id}/attach`, { order_id: open.id }], ['POST', `/api/observations/${ing.observation_id}/ignore`],
      ['PATCH', `/api/vpas/${vpa.id}`, { label: 'pwned' }], ['DELETE', `/api/vpas/${vpa.id}`],
      ['PATCH', `/api/team/${member.id}`, { role: 'viewer' }], ['DELETE', `/api/team/${member.id}`],
      ['POST', `/api/api-keys/${key.id}/revoke`], ['GET', `/api/events/${evt.id}`],
    ];
    for (const [method, url, body] of dash) {
      const r = await srv.request(method, url, { ...B, body });
      assert.equal(r.status, 404, `${method} ${url} -> ${r.status} ${r.text}`);
    }
    // B attaching its own observation to A's order.
    const bObs = (await srv.request('POST', '/api/observers', { cookie: b.cookie, body: { name: 'B phone' } })).json;
    const bIng = (await srv.request('POST', '/v1/observers/ingest', { headers: { 'X-Observer-Token': bObs.token }, body: { text: 'Rs 510.00 credited to a/c XX1 UPI Ref 700000000002' } })).json;
    assert.equal(bIng.status, 'unmatched', 'B observer must not match A orders');
    const cross = await srv.request('POST', `/api/observations/${bIng.observation_id}/attach`, { cookie: b.cookie, body: { order_id: open.id } });
    assert.equal(cross.status, 404);

    const v1 = [
      ['GET', `/v1/orders/${o.id}`], ['GET', `/v1/orders/${o.id}/payments`], ['POST', `/v1/orders/${open.id}/cancel`],
      ['GET', `/v1/payments/${pay.id}`], ['POST', '/v1/refunds', { payment_id: pay.id, amount: 100 }], ['GET', `/v1/refunds/${rf.id}`],
      ['GET', `/v1/payment_links/${link.id}`], ['POST', `/v1/payment_links/${link.id}/cancel`],
      ['POST', `/v1/test/orders/${open.id}/simulate`, { outcome: 'success' }],
    ];
    for (const [method, url, body] of v1) {
      const r = await srv.request(method, url, { auth: b.key, body });
      assert.equal(r.status, 404, `${method} ${url} -> ${r.status}`);
    }
    const listB = (await srv.request('GET', '/v1/orders', { auth: b.key })).json;
    assert.ok(!listB.items.some((x) => x.merchant_id || x.id === o.id));

    // Nothing of A's changed.
    assert.equal(one(srv.db, 'SELECT status FROM orders WHERE id=?', open.id).status, 'created');
    assert.equal(one(srv.db, 'SELECT status FROM refunds WHERE id=?', rf.id).status, 'pending');
    assert.equal(one(srv.db, 'SELECT status FROM payment_links WHERE id=?', link.id).status, 'active');
    assert.equal(one(srv.db, 'SELECT url FROM webhook_endpoints WHERE id=?', wh.id).url, hook.url);
    assert.ok(one(srv.db, 'SELECT id FROM observers WHERE id=?', obs.id));
    assert.equal(one(srv.db, 'SELECT label FROM vpas WHERE id=?', vpa.id).label, null);
    assert.equal(one(srv.db, 'SELECT role FROM users WHERE id=?', member.id).role, 'developer');
    assert.equal(one(srv.db, 'SELECT status FROM api_keys WHERE id=?', key.id).status, 'active');
    assert.equal(one(srv.db, 'SELECT status FROM observations WHERE id=?', ing.observation_id).status, 'unmatched');
  } finally {
    await hook.close();
  }
});
