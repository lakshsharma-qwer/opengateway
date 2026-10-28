/** Dashboard search treats `_` and `%` literally (regression: they used to be stripped). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, signup } from './helpers.js';
import { waitForDeliveries } from '../src/lib/webhooks.js';

let srv;
before(async () => { srv = await startTestServer(); });
after(async () => { await waitForDeliveries(); await srv.close(); });

test('search by full id and by receipt containing _ or % matches literally', async () => {
  const m = await signup(srv);
  const a = await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 10000, receipt: 'rcpt_1' } });
  await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 10000, receipt: 'rcptX1' } });
  await srv.request('POST', '/v1/orders', { auth: m.key, body: { amount: 10000, receipt: '50%off' } });
  const ids = async (q) => (await srv.request('GET', `/api/orders?mode=test&q=${encodeURIComponent(q)}`, { cookie: m.cookie })).json.items.map((o) => o.receipt);

  assert.deepEqual(await ids('rcpt_1'), ['rcpt_1']);          // `_` is not a wildcard
  assert.deepEqual(await ids('%'), ['50%off']);                // `%` is not a wildcard
  assert.deepEqual(await ids(a.json.id), ['rcpt_1']);          // full order id
  assert.equal((await ids('\\')).length, 0);                   // escape char itself is safe
});
