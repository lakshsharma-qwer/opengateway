/**
 * npm run seed — creates the demo merchant with credentials and ~40 historical
 * orders across the last 30 days, then writes data/demo-credentials.json.
 * Re-running replaces the previous demo merchant.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, runtime } from '../src/config.js';
import { openDb, one, run, tx, now } from '../src/db.js';
import { initMasterKey } from '../src/lib/crypto.js';
import { ids } from '../src/lib/ids.js';
import {
  createMerchantWithOwner, createObserver, createVpa, createWebhookEndpoint, observerIngestUrl,
} from '../src/lib/merchants.js';
import * as S from '../src/lib/serialize.js';

const DEMO = { email: 'demo@opengateway.dev', password: 'demo12345', business_name: 'Demo Store', name: 'Demo Owner' };
const DEMO_STORE_URL = process.env.DEMO_STORE_URL || 'http://localhost:5050';

const config = loadConfig();
runtime.publicUrl = config.publicUrl;
initMasterKey(config);
const db = openDb(config.dbFile);

// Deterministic-ish PRNG so the dashboard looks the same each seed.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const existing = one(db, 'SELECT merchant_id FROM users WHERE email=?', DEMO.email);
if (existing) {
  run(db, 'DELETE FROM merchants WHERE id=?', existing.merchant_id);
  console.log('Removed previous demo merchant', existing.merchant_id);
}

const { merchant, key } = await createMerchantWithOwner(db, { ...DEMO, phone: '9876543210' });
run(db, `UPDATE merchants SET business_type=?, support_email=?, support_phone=?, website=?, onboarding_completed=1 WHERE id=?`,
  'Retail / e-commerce', 'support@demostore.dev', '9876543210', DEMO_STORE_URL, merchant.id);
const vpa = createVpa(db, merchant.id, 'test', { vpa: 'demostore@okaxis', payee_name: 'Demo Store', label: 'Primary' });
const observer = createObserver(db, merchant.id, 'test', 'Demo phone (test)');
const webhook = createWebhookEndpoint(db, merchant.id, 'test', {
  url: `${DEMO_STORE_URL}/webhook`, description: 'Demo store webhook', events: ['*'],
});

const PRODUCTS = [
  { name: 'Masala Chai Kit', amount: 49900 },
  { name: 'Handloom Tote Bag', amount: 129900 },
  { name: 'Brass Diya Set', amount: 89900 },
  { name: 'Filter Coffee 500g', amount: 39900 },
  { name: 'Block-print Cushion Cover', amount: 69900 },
  { name: 'Gift card', amount: 200000 },
  { name: 'Spice sampler', amount: 24900 },
];
const CUSTOMERS = [
  ['Aarav Sharma', 'aarav@example.com', '9810011223'],
  ['Priya Nair', 'priya@example.com', '9820022334'],
  ['Rohan Gupta', 'rohan@example.com', '9830033445'],
  ['Ananya Iyer', 'ananya@example.com', '9840044556'],
  ['Vikram Singh', 'vikram@example.com', '9850055667'],
  ['Meera Joshi', 'meera@example.com', '9860066778'],
  ['Kabir Khan', 'kabir@example.com', '9870077889'],
];
const APPS = ['gpay', 'gpay', 'gpay', 'phonepe', 'phonepe', 'phonepe', 'paytm', 'paytm', 'bhim', 'cred', 'other'];
const PSP = { gpay: 'okicici', phonepe: 'ybl', paytm: 'paytm', bhim: 'upi', cred: 'axl', other: 'okhdfcbank' };

const t0 = now();
const utrFor = (i) => `4${String(100000000000 + i * 7919 + Math.floor(rand() * 1000)).slice(1)}`.slice(0, 12);

function insertEvent(type, order, payment, data, createdAt) {
  run(db, 'INSERT INTO events (id, merchant_id, mode, type, order_id, payment_id, data, created_at) VALUES (?,?,?,?,?,?,?,?)',
    ids.event(), merchant.id, 'test', type, order.id, payment?.id ?? null, JSON.stringify(data), createdAt);
}

let counts = { paid: 0, expired: 0, cancelled: 0, open: 0, refunds: 0 };
tx(db, () => {
  for (let i = 0; i < 40; i++) {
    const product = pick(PRODUCTS);
    const [cname, cemail, cphone] = pick(CUSTOMERS);
    const dayOffset = Math.floor(rand() * 30);
    const createdAt = t0 - dayOffset * 86400 - Math.floor(rand() * 20 * 3600) - 600;
    const r = rand();
    const status = r < 0.76 ? 'paid' : r < 0.9 ? 'expired' : 'cancelled';
    const qty = 1 + Math.floor(rand() * 2);
    const amount = product.amount * qty;
    const payable = amount + Math.floor(rand() * 3);
    const app = pick(APPS);
    const flow = app === 'other' ? 'qr' : rand() < 0.6 ? 'intent' : 'qr';
    const orderId = ids.order();
    const order = {
      id: orderId, amount, payable, createdAt,
      customer: JSON.stringify({ name: cname, email: cemail, phone: cphone }),
    };
    const expiresAt = createdAt + 900;
    const paidAt = status === 'paid' ? createdAt + 30 + Math.floor(rand() * 240) : null;
    const utr = status === 'paid' ? utrFor(i) : null;
    run(db, `INSERT INTO orders (id, merchant_id, mode, amount, amount_payable, amount_paid, currency, receipt, notes, customer, description, status,
               vpa_id, vpa, payee_name, payment_session_id, return_url, utr, paid_at, expires_at, closed_at, created_at, updated_at)
             VALUES (?,?,'test',?,?,?,'INR',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      orderId, merchant.id, amount, payable, status === 'paid' ? payable : 0, `rcpt_${1000 + i}`,
      JSON.stringify({ product: product.name, qty: String(qty) }), order.customer, `${product.name}${qty > 1 ? ` x${qty}` : ''}`, status,
      vpa.id, vpa.vpa, vpa.payee_name, ids.session(), `${DEMO_STORE_URL}/return`, utr, paidAt, expiresAt, paidAt || expiresAt, createdAt, paidAt || expiresAt);
    const orderRow = one(db, 'SELECT * FROM orders WHERE id=?', orderId);

    // One payment attempt per order (cancelled orders sometimes never got one).
    if (status === 'cancelled' && rand() < 0.4) {
      insertEvent('order.cancelled', orderRow, null, { order: S.order(orderRow), payment: null }, createdAt + 120);
      counts.cancelled++;
      continue;
    }
    const payId = ids.payment();
    const verifiedBy = status === 'paid' ? (rand() < 0.8 ? 'observer' : 'merchant') : null;
    const payStatus = status === 'paid' ? 'captured' : 'failed';
    const err = status === 'expired' ? ['ORDER_EXPIRED', 'The order expired before the payment was verified']
      : status === 'cancelled' ? ['USER_CANCELLED', 'The customer cancelled the payment'] : [null, null];
    const payerVpa = status === 'paid' ? `${cname.split(' ')[0].toLowerCase()}@${PSP[app]}` : null;
    let obsId = null;
    if (verifiedBy === 'observer') {
      obsId = ids.observation();
      const text = `Rs.${(payable / 100).toFixed(2)} credited to A/c XX4821 on ${new Date(paidAt * 1000).toLocaleDateString('en-GB')} from VPA ${payerVpa} (UPI Ref No ${utr}). Avl Bal Rs.84,210.00`;
      run(db, `INSERT INTO observations (id, merchant_id, mode, observer_id, raw_text, sender, text_hash, direction, amount, utr, payer_vpa, status, order_id, created_at)
               VALUES (?,?,'test',?,?,?,?,'credit',?,?,?,'matched',?,?)`,
        obsId, merchant.id, observer.row.id, text, 'VM-AXISBK', `seed-${obsId}`, payable, utr, payerVpa, orderId, paidAt);
    }
    run(db, `INSERT INTO payments (id, merchant_id, mode, order_id, amount, currency, status, method, flow, upi_app, utr, payer_vpa, verified_by, observation_id,
               error_code, error_description, created_at, captured_at, updated_at)
             VALUES (?,?,'test',?,?,'INR',?,'upi',?,?,?,?,?,?,?,?,?,?,?)`,
      payId, merchant.id, orderId, payable, payStatus, flow, app, utr, payerVpa, verifiedBy, obsId, err[0], err[1],
      createdAt + 20, paidAt, paidAt || createdAt + 900);
    const payRow = one(db, 'SELECT * FROM payments WHERE id=?', payId);

    if (status === 'paid') {
      insertEvent('payment.captured', orderRow, payRow, { payment: S.payment(payRow), order: S.order(orderRow) }, paidAt);
      insertEvent('order.paid', orderRow, payRow, { order: S.order(orderRow), payment: S.payment(payRow) }, paidAt);
      counts.paid++;
      if (rand() < 0.1) {
        const refundAmount = rand() < 0.5 ? payable : Math.floor(payable / 2);
        const processed = rand() < 0.6;
        const rid = ids.refund();
        const rAt = paidAt + 86400;
        run(db, `INSERT INTO refunds (id, merchant_id, mode, payment_id, order_id, amount, currency, status, notes, utr, created_at, processed_at)
                 VALUES (?,?,'test',?,?,?,'INR',?,?,?,?,?)`,
          rid, merchant.id, payId, orderId, refundAmount, processed ? 'processed' : 'pending', JSON.stringify({ reason: 'Customer request' }),
          processed ? utrFor(i + 500) : null, Math.min(rAt, t0 - 60), processed ? Math.min(rAt + 3600, t0) : null);
        counts.refunds++;
      }
    } else if (status === 'expired') {
      insertEvent('order.expired', orderRow, null, { order: S.order(orderRow) }, expiresAt);
      counts.expired++;
    } else {
      insertEvent('order.cancelled', orderRow, payRow, { order: S.order(orderRow), payment: S.payment(payRow) }, createdAt + 180);
      counts.cancelled++;
    }
  }

  // Two live-looking open orders: one awaiting verification, one fresh.
  for (const [n, product, pending] of [[0, PRODUCTS[1], true], [1, PRODUCTS[3], false]]) {
    const orderId = ids.order();
    const createdAt = t0 - 300 - n * 60;
    const [cname, cemail, cphone] = CUSTOMERS[n];
    const payable = product.amount + 7 + n;
    run(db, `INSERT INTO orders (id, merchant_id, mode, amount, amount_payable, amount_paid, currency, receipt, notes, customer, description, status,
               vpa_id, vpa, payee_name, payment_session_id, return_url, expires_at, created_at, updated_at)
             VALUES (?,?,'test',?,?,0,'INR',?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      orderId, merchant.id, product.amount, payable, `rcpt_open_${n}`, JSON.stringify({ product: product.name }),
      JSON.stringify({ name: cname, email: cemail, phone: cphone }), product.name, pending ? 'attempted' : 'created',
      vpa.id, vpa.vpa, vpa.payee_name, ids.session(), `${DEMO_STORE_URL}/return`, t0 + 86400, createdAt, createdAt);
    if (pending) {
      run(db, `INSERT INTO payments (id, merchant_id, mode, order_id, amount, currency, status, method, flow, upi_app, utr, created_at, updated_at)
               VALUES (?,?,'test',?,?,'INR','pending_verification','upi','intent','phonepe',?,?,?)`,
        ids.payment(), merchant.id, orderId, payable, '512398765432', createdAt + 30, createdAt + 90);
    }
    counts.open++;
  }

  // Two unmatched credits waiting for manual attachment.
  for (const [amt, utr, vpaStr, ago] of [[59900, '612300011122', 'guest@ybl', 1800], [100000, '612300033344', 'walkin@okaxis', 7200]]) {
    const id = ids.observation();
    run(db, `INSERT INTO observations (id, merchant_id, mode, observer_id, raw_text, sender, text_hash, direction, amount, utr, payer_vpa, status, created_at)
             VALUES (?,?,'test',?,?,?,?,'credit',?,?,?,'unmatched',?)`,
      id, merchant.id, observer.row.id,
      `INR ${(amt / 100).toFixed(2)} credited to A/c no. XX4821 on ${new Date().toLocaleDateString('en-GB')}. Info- UPI/P2A/${utr}/${vpaStr}/Axis Bank. Avl Bal INR 84,210.00`,
      'AX-AXISBK', `seed-${id}`, amt, utr, vpaStr, t0 - ago);
  }
});
run(db, 'UPDATE observers SET last_seen_at=? WHERE id=?', t0 - 600, observer.row.id);

const creds = {
  base_url: `http://localhost:${config.port}`,
  public_url: config.publicUrl,
  dashboard: { email: DEMO.email, password: DEMO.password },
  merchant_id: merchant.id,
  key_id: key.row.id,
  key_secret: key.secret,
  observer_id: observer.row.id,
  observer_token: observer.token,
  ingest_url: observerIngestUrl(observer.token),
  webhook_id: webhook.row.id,
  webhook_url: webhook.row.url,
  webhook_secret: webhook.secret,
  vpa: vpa.vpa,
};
const file = path.join(config.dataDir, 'demo-credentials.json');
fs.writeFileSync(file, JSON.stringify(creds, null, 2) + '\n', { mode: 0o600 });
db.close();

console.log(`
OpenGateway demo merchant ready
  Dashboard login : ${DEMO.email} / ${DEMO.password}
  Merchant        : ${merchant.id} (${DEMO.business_name})
  Test VPA        : ${vpa.vpa}
  API key id      : ${creds.key_id}
  API key secret  : ${creds.key_secret}
  Observer token  : ${creds.observer_token}
  Ingest URL      : ${creds.ingest_url}
  Webhook         : ${creds.webhook_url}  (secret ${creds.webhook_secret})
  Seeded          : ${counts.paid} paid, ${counts.expired} expired, ${counts.cancelled} cancelled, ${counts.open} open, ${counts.refunds} refunds
  Saved to        : ${file}
`);
