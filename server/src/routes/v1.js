/** Merchant REST API — /v1 (HTTP Basic key_id:key_secret). */
import express from 'express';
import { one, run, now } from '../db.js';
import { ids } from '../lib/ids.js';
import { sha256, safeEqual } from '../lib/crypto.js';
import { notFound, unauthorized, validation } from '../lib/errors.js';
import { idempotencyMiddleware } from '../lib/idempotency.js';
import { paginate } from '../lib/http.js';
import * as S from '../lib/serialize.js';
import {
  cancelOrder, cancelPaymentLink, createOrder, createPaymentLink, createRefund, expireIfDue, getMerchant, simulateOutcome,
} from '../lib/orders.js';

/** CORS for /v1 — merchant servers (and browsers, for testing) may call it from anywhere. */
export function v1Cors(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Observer-Token');
  res.set('Access-Control-Expose-Headers', 'RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After, Idempotent-Replayed');
  res.set('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

function apiKeyAuth(db) {
  return (req, res, next) => {
    const h = req.get('Authorization') || '';
    const m = /^Basic\s+(.+)$/i.exec(h);
    const fail = () => next(unauthorized('INVALID_API_KEY', 'Invalid API key. Use HTTP Basic auth with key_id:key_secret.'));
    if (!m) return fail();
    let decoded;
    try { decoded = Buffer.from(m[1].trim(), 'base64').toString('utf8'); } catch { return fail(); }
    const i = decoded.indexOf(':');
    if (i < 0) return fail();
    const keyId = decoded.slice(0, i);
    const secret = decoded.slice(i + 1);
    const key = one(db, 'SELECT * FROM api_keys WHERE id=?', keyId);
    if (!key || key.status !== 'active' || !safeEqual(sha256(secret), key.secret_hash)) return fail();
    const merchant = getMerchant(db, key.merchant_id);
    if (!merchant) return fail();
    const t = now();
    if (!key.last_used_at || t - key.last_used_at >= 30) run(db, 'UPDATE api_keys SET last_used_at=? WHERE id=?', t, key.id);
    req.apiKey = key;
    req.merchant = merchant;
    req.mode = key.mode;
    next();
  };
}

/** Record /v1 requests for the dashboard "API logs" page. */
export function apiLogger(db, { keyId = (req) => req.apiKey?.id ?? null } = {}) {
  return (req, res, next) => {
    const started = performance.now();
    res.on('finish', () => {
      if (!req.merchant) return;
      try {
        run(db, `INSERT INTO api_logs (id, merchant_id, mode, method, path, status, duration_ms, key_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
          ids.apiLog(), req.merchant.id, req.mode, req.method, req.originalUrl.split('?')[0], res.statusCode,
          Math.round(performance.now() - started), keyId(req), now());
      } catch (err) {
        console.error('[api-log]', err.message);
      }
    });
    next();
  };
}

export function v1Router(ctx) {
  const { db, limiters } = ctx;
  const r = express.Router();

  r.use(apiKeyAuth(db));
  r.use(apiLogger(db));
  r.use(limiters.v1.middleware((req) => `key:${req.apiKey.id}`));
  r.use(idempotencyMiddleware(db));

  const scope = (req) => ({ where: ['merchant_id = ?', 'mode = ?'], params: [req.merchant.id, req.mode] });
  const findOwned = (table, req, id) => one(db, `SELECT * FROM ${table} WHERE id=? AND merchant_id=? AND mode=?`, id, req.merchant.id, req.mode);
  const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

  // ---- orders ----
  r.post('/orders', (req, res) => {
    const order = createOrder(db, req.merchant, req.mode, body(req));
    res.status(201).json(S.order(order));
  });

  r.get('/orders', (req, res) => {
    const { where, params } = scope(req);
    if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
    if (req.query.receipt) { where.push('receipt = ?'); params.push(String(req.query.receipt)); }
    res.json(paginate(db, { table: 'orders', where, params, query: req.query, map: S.order }));
  });

  r.get('/orders/:id', (req, res) => {
    const o = findOwned('orders', req, req.params.id);
    if (!o) throw notFound('Order not found');
    res.json(S.order(expireIfDue(db, o)));
  });

  r.get('/orders/:id/payments', (req, res) => {
    const o = findOwned('orders', req, req.params.id);
    if (!o) throw notFound('Order not found');
    res.json(paginate(db, { table: 'payments', where: ['order_id = ?'], params: [o.id], query: req.query, map: S.payment }));
  });

  r.post('/orders/:id/cancel', (req, res) => {
    const o = findOwned('orders', req, req.params.id);
    if (!o) throw notFound('Order not found');
    res.json(S.order(cancelOrder(db, o)));
  });

  // ---- payments ----
  r.get('/payments', (req, res) => {
    const { where, params } = scope(req);
    if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
    res.json(paginate(db, { table: 'payments', where, params, query: req.query, map: S.payment }));
  });

  r.get('/payments/:id', (req, res) => {
    const p = findOwned('payments', req, req.params.id);
    if (!p) throw notFound('Payment not found');
    res.json(S.payment(p));
  });

  // ---- refunds ----
  r.post('/refunds', (req, res) => {
    res.status(201).json(S.refund(createRefund(db, req.merchant, req.mode, body(req))));
  });

  r.get('/refunds', (req, res) => {
    const { where, params } = scope(req);
    if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
    if (req.query.payment_id) { where.push('payment_id = ?'); params.push(String(req.query.payment_id)); }
    res.json(paginate(db, { table: 'refunds', where, params, query: req.query, map: S.refund }));
  });

  r.get('/refunds/:id', (req, res) => {
    const x = findOwned('refunds', req, req.params.id);
    if (!x) throw notFound('Refund not found');
    res.json(S.refund(x));
  });

  // ---- payment links ----
  r.post('/payment_links', (req, res) => {
    res.status(201).json(S.paymentLink(createPaymentLink(db, req.merchant, req.mode, body(req))));
  });

  r.get('/payment_links', (req, res) => {
    const { where, params } = scope(req);
    if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
    if (req.query.reference_id) { where.push('reference_id = ?'); params.push(String(req.query.reference_id)); }
    res.json(paginate(db, { table: 'payment_links', where, params, query: req.query, map: S.paymentLink }));
  });

  r.get('/payment_links/:id', (req, res) => {
    const x = findOwned('payment_links', req, req.params.id);
    if (!x) throw notFound('Payment link not found');
    res.json(S.paymentLink(x));
  });

  r.post('/payment_links/:id/cancel', (req, res) => {
    const x = findOwned('payment_links', req, req.params.id);
    if (!x) throw notFound('Payment link not found');
    res.json(S.paymentLink(cancelPaymentLink(db, x)));
  });

  // ---- test helpers ----
  r.post('/test/orders/:id/simulate', (req, res) => {
    if (req.mode !== 'test') {
      const e = validation('Simulation is only available with test keys');
      e.status = 403; e.code = 'TEST_MODE_ONLY';
      throw e;
    }
    const o = findOwned('orders', req, req.params.id);
    if (!o) throw notFound('Order not found');
    res.json(S.order(simulateOutcome(db, o, body(req).outcome)));
  });

  r.use((req, res, next) => next(notFound(`No route ${req.method} ${req.originalUrl.split('?')[0]}`)));
  return r;
}
