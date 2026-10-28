/**
 * Demo merchant store for OpenGateway (port 5050).
 * - "Buy" -> backend creates an order via POST /v1/orders -> browser opens checkout.js (modal)
 * - Verifies og_signature server-side on success / return
 * - Receives signed webhooks at /webhook and shows them on /orders
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT_DEMO_STORE || process.env.DEMO_STORE_PORT || 5050);
const OG_BASE_URL = (process.env.OG_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const STORE_URL = (process.env.DEMO_STORE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const CREDS_FILE = path.resolve(here, '../server/data/demo-credentials.json');

/** Credentials: env first, then the seed's demo-credentials.json (re-read so seeding after start works). */
function creds() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch {}
  return {
    keyId: process.env.OG_KEY_ID || file.key_id,
    keySecret: process.env.OG_KEY_SECRET || file.key_secret,
    webhookSecret: process.env.OG_WEBHOOK_SECRET || file.webhook_secret,
  };
}

const PRODUCTS = [
  { id: 'chai', name: 'Masala Chai Kit', blurb: 'Assam CTC, cardamom, ginger and a hand-thrown kulhad pair.', amount: 49900, hue: 28 },
  { id: 'tote', name: 'Handloom Tote', blurb: 'Hand-woven cotton from Chanderi with a block-printed lining.', amount: 129900, hue: 200 },
  { id: 'diya', name: 'Brass Diya Set', blurb: 'Set of four polished brass diyas, made in Moradabad.', amount: 89900, hue: 45 },
];

// In-memory activity log (this is a demo).
const orders = new Map(); // order_id -> { ...order summary, verified }
const webhooks = []; // newest first
const seenEvents = new Set(); // event ids already processed (webhooks are retried: handle each event once)
const TERMINAL = new Set(['paid', 'expired', 'cancelled']);

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'DENY');
  next();
});

// ---- webhook: verify X-OpenGateway-Signature against the raw body ----------
app.post('/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
  const raw = req.body instanceof Buffer ? req.body.toString('utf8') : '';
  const header = req.get('X-OpenGateway-Signature') || '';
  const { webhookSecret } = creds();
  const verified = !!webhookSecret && verifySignature(webhookSecret, header, raw);
  let event = null;
  try { event = JSON.parse(raw); } catch {}
  const entry = {
    received_at: Math.floor(Date.now() / 1000),
    delivery_id: req.get('X-OpenGateway-Delivery-Id') || null,
    event_id: event?.id || req.get('X-OpenGateway-Event-Id') || null,
    type: event?.type || req.get('X-OpenGateway-Event') || 'unknown',
    verified,
    order_id: event?.data?.order?.id || event?.data?.payment?.order_id || null,
    status: event?.data?.order?.status || event?.data?.payment?.status || null,
  };
  webhooks.unshift(entry);
  webhooks.length = Math.min(webhooks.length, 200);
  console.log(`[webhook] ${entry.type} ${entry.event_id} verified=${verified}${entry.order_id ? ` order=${entry.order_id}` : ''}`);
  if (!verified) return res.status(400).json({ ok: false, error: 'invalid signature' });
  // Idempotent: a retried delivery of an event we already handled is acknowledged and ignored.
  if (entry.event_id && seenEvents.has(entry.event_id)) return res.json({ ok: true, duplicate: true });
  if (entry.event_id) {
    seenEvents.add(entry.event_id);
    if (seenEvents.size > 5000) seenEvents.delete(seenEvents.values().next().value);
  }
  const local = entry.order_id && orders.get(entry.order_id);
  if (local && event?.data?.order) {
    const next = event.data.order.status;
    // Never move a paid order backwards (events can arrive out of order).
    if (local.status !== 'paid' && (TERMINAL.has(next) || !TERMINAL.has(local.status))) {
      Object.assign(local, { status: next, utr: event.data.order.utr ?? null });
    }
  }
  res.json({ ok: true });
});

function verifySignature(secret, header, raw, toleranceSec = 600) {
  if (typeof header !== 'string' || header.length > 512) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=')));
  const t = Number(parts.t);
  if (!t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(parts.v1));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyCheckoutSignature(orderId, paymentId, signature) {
  const { keySecret } = creds();
  if (!keySecret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function og(method, url, body) {
  const { keyId, keySecret } = creds();
  if (!keyId || !keySecret) {
    const err = new Error('No OpenGateway API key configured. Run `npm run seed` or set OG_KEY_ID / OG_KEY_SECRET.');
    err.status = 500;
    throw err;
  }
  const res = await fetch(`${OG_BASE_URL}${url}`, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      'Content-Type': 'application/json',
      ...(method === 'POST' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `OpenGateway error ${res.status}`);
    err.status = res.status;
    err.og = json?.error;
    throw err;
  }
  return json;
}

app.use(express.json({ limit: '16kb' }));

const page = (file) => fs.readFileSync(path.join(here, 'public', file), 'utf8')
  .replaceAll('__OG_BASE_URL__', OG_BASE_URL)
  .replaceAll('__PRODUCTS__', JSON.stringify(PRODUCTS));

app.get('/', (req, res) => res.type('html').send(page('index.html')));
app.get('/orders', (req, res) => res.type('html').send(page('orders.html')));
app.get('/api/products', (req, res) => res.json(PRODUCTS));

app.post('/api/buy', async (req, res) => {
  const product = PRODUCTS.find((p) => p.id === req.body?.product_id);
  if (!product) return res.status(400).json({ error: 'Unknown product' });
  const customer = {};
  for (const k of ['name', 'email', 'phone']) if (req.body?.customer?.[k]) customer[k] = String(req.body.customer[k]);
  try {
    const order = await og('POST', '/v1/orders', {
      amount: product.amount,
      receipt: `demo_${Date.now().toString(36)}`,
      notes: { product: product.id },
      customer,
      return_url: `${STORE_URL}/return`,
    });
    orders.set(order.id, {
      id: order.id, product: product.name, amount: order.amount, amount_payable: order.amount_payable,
      status: order.status, created_at: order.created_at, verified: false, utr: null,
    });
    res.json({ order_id: order.id, session_id: order.payment_session_id, amount_payable: order.amount_payable, checkout_url: order.checkout_url });
  } catch (err) {
    res.status(err.status && err.status < 500 ? 400 : 502).json({ error: err.message, code: err.og?.code });
  }
});

/** Called by the page's onSuccess handler. Never trust the browser: check the signature and re-fetch. */
app.post('/api/verify', async (req, res) => {
  const { order_id, payment_id, signature } = req.body || {};
  if (typeof order_id !== 'string' || !/^order_[0-9A-Za-z]{14}$/.test(order_id)) return res.status(400).json({ verified: false, error: 'bad order_id' });
  const verified = verifyCheckoutSignature(order_id, payment_id, signature);
  let order = null;
  try { order = await og('GET', `/v1/orders/${encodeURIComponent(order_id)}`); } catch {}
  const ok = verified && order?.status === 'paid';
  if (orders.has(order_id)) Object.assign(orders.get(order_id), { verified: ok, status: order?.status ?? orders.get(order_id).status, utr: order?.utr ?? null });
  res.json({ verified: ok, signature_valid: verified, order_status: order?.status ?? null, utr: order?.utr ?? null });
});

/** Redirect-mode return URL. */
app.get('/return', async (req, res) => {
  const { og_order_id, og_payment_id, og_status, og_signature } = req.query;
  const sigOk = og_status === 'paid' && verifyCheckoutSignature(og_order_id, og_payment_id, og_signature);
  if (sigOk && orders.has(og_order_id)) Object.assign(orders.get(og_order_id), { verified: true, status: 'paid' });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const title = sigOk ? 'Payment successful' : og_status === 'paid' ? 'Signature check failed' : `Payment ${esc(og_status || 'unknown')}`;
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Demo Store</title><link rel="stylesheet" href="/style.css"></head>
<body><main class="result ${sigOk ? 'ok' : 'bad'}"><h1>${title}</h1>
<p>Order <code>${esc(og_order_id)}</code>${og_payment_id ? ` · Payment <code>${esc(og_payment_id)}</code>` : ''}</p>
<p class="muted">${sigOk ? 'The og_signature was verified on our server with the API key secret.' : 'No verified payment for this order.'}</p>
<p><a class="btn" href="/">Back to store</a> <a class="btn ghost" href="/orders">See orders &amp; webhooks</a></p></main></body></html>`);
});

app.get('/api/activity', (req, res) => {
  res.json({ orders: [...orders.values()].sort((a, b) => b.created_at - a.created_at), webhooks, og_base_url: OG_BASE_URL });
});

app.use(express.static(path.join(here, 'public'), { index: false }));

app.listen(PORT, () => {
  const c = creds();
  console.log(`Demo store on ${STORE_URL}  (gateway ${OG_BASE_URL})`);
  if (!c.keyId) console.log('  ! No API key yet. Run `npm run seed` (or set OG_KEY_ID / OG_KEY_SECRET).');
  if (!c.webhookSecret) console.log('  ! No webhook secret. Set OG_WEBHOOK_SECRET or run the seed.');
});
