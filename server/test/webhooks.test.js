import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startTestServer, signup, startWebhookReceiver } from './helpers.js';
import { BACKOFF_SECONDS, signWebhook, verifyWebhookSignature, waitForDeliveries, processDueDeliveries } from '../src/lib/webhooks.js';
import { run, one } from '../src/db.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await waitForDeliveries(); await srv.close(); });

test('signature format is t=<unix>,v1=<hex hmac(secret, t.body)>', () => {
  const body = '{"id":"evt_1"}';
  const sig = signWebhook('whsec_abc', body, 1700000000);
  const expected = crypto.createHmac('sha256', 'whsec_abc').update(`1700000000.${body}`).digest('hex');
  assert.equal(sig, `t=1700000000,v1=${expected}`);
  assert.ok(verifyWebhookSignature('whsec_abc', sig, body, 0));
  assert.ok(!verifyWebhookSignature('whsec_abc', sig, body + ' ', 0));
  assert.ok(!verifyWebhookSignature('whsec_abc', sig, body), 'stale timestamp rejected with tolerance');
});

test('test ping, failure backoff, resend, reveal secret, event filter', async () => {
  const m = await signup(srv);
  const hook = await startWebhookReceiver((n) => (n === 2 ? 500 : 200));
  try {
    const wh = (await srv.request('POST', '/api/webhooks', { cookie: m.cookie, body: { url: hook.url, events: ['order.paid'], description: 'main' } })).json;
    assert.equal(wh.events[0], 'order.paid');
    const list = await srv.request('GET', '/api/webhooks?mode=test', { cookie: m.cookie });
    assert.equal(list.json.items[0].secret, undefined, 'secret not listed');

    const ping = await srv.request('POST', `/api/webhooks/${wh.id}/test`, { cookie: m.cookie });
    assert.equal(ping.json.status, 'success');
    assert.equal(ping.json.event_type, 'ping');
    assert.equal(ping.json.response_status, 200);
    assert.equal(hook.received[0].body.type, 'ping');
    assert.ok(verifyWebhookSignature(wh.secret, hook.received[0].headers['x-opengateway-signature'], hook.received[0].raw));

    const rev = await srv.request('POST', `/api/webhooks/${wh.id}/reveal-secret`, { cookie: m.cookie });
    assert.equal(rev.json.secret, wh.secret);

    // Second request returns 500 -> pending with 1 minute backoff.
    const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 5000 } })).json;
    await srv.request('POST', `/v1/test/orders/${o.id}/simulate`, { auth: m.key, body: { outcome: 'success' } });
    await waitForDeliveries();
    assert.equal(hook.received.length, 2, 'only order.paid is subscribed (plus ping)');
    const dels = (await srv.request('GET', `/api/webhooks/${wh.id}/deliveries`, { cookie: m.cookie })).json.items;
    const failed = dels.find((d) => d.event_type === 'order.paid');
    assert.equal(failed.status, 'pending');
    assert.equal(failed.attempts, 1);
    assert.equal(failed.response_status, 500);
    assert.ok(failed.next_attempt_at - Math.floor(Date.now() / 1000) >= BACKOFF_SECONDS[0] - 2);

    // Job retry when due -> success.
    run(srv.db, 'UPDATE webhook_deliveries SET next_attempt_at=? WHERE id=?', 1, failed.id);
    await processDueDeliveries(srv.db);
    const after = one(srv.db, 'SELECT * FROM webhook_deliveries WHERE id=?', failed.id);
    assert.equal(after.status, 'success');
    assert.equal(after.attempts, 2);

    // Manual resend creates a new delivery.
    const rs = await srv.request('POST', `/api/webhook-deliveries/${failed.id}/resend`, { cookie: m.cookie });
    assert.equal(rs.json.status, 'success');
    assert.notEqual(rs.json.id, failed.id);
    assert.equal(hook.received.at(-1).headers['x-opengateway-event-id'], hook.received[1].headers['x-opengateway-event-id']);
  } finally {
    await hook.close();
  }
});

test('delivery fails permanently after 7 attempts', async () => {
  const m = await signup(srv);
  const hook = await startWebhookReceiver(() => 503);
  try {
    await srv.request('POST', '/api/webhooks', { cookie: m.cookie, body: { url: hook.url } });
    const o = (await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 5000 } })).json;
    await srv.request('POST', `/v1/orders/${o.id}/cancel`, { auth: m.key });
    await waitForDeliveries();
    const d = one(srv.db, `SELECT * FROM webhook_deliveries WHERE merchant_id=? AND event_type='order.cancelled'`, m.merchant.id);
    for (let i = 0; i < 6; i++) {
      run(srv.db, 'UPDATE webhook_deliveries SET next_attempt_at=1 WHERE id=?', d.id);
      await processDueDeliveries(srv.db);
    }
    const final = one(srv.db, 'SELECT * FROM webhook_deliveries WHERE id=?', d.id);
    assert.equal(final.attempts, 7);
    assert.equal(final.status, 'failed');
    assert.equal(final.next_attempt_at, null);
  } finally {
    await hook.close();
  }
});
