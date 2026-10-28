/** Dashboard API — /api/* (cookie session, role checks). */
import express from 'express';
import { one, all, run, tx, now } from '../db.js';
import { ids } from '../lib/ids.js';
import { decrypt, hashPassword } from '../lib/crypto.js';
import { badRequest, conflict, forbidden, notFound, validation } from '../lib/errors.js';
import {
  collection, optBool, optInt, optString, paginate, parseMode, reqString,
} from '../lib/http.js';
import { requireRole, requireSession, viewerReadOnly } from '../lib/sessions.js';
import { parseSms } from '../lib/sms-parser.js';
import { resendDelivery, sendTestPing } from '../lib/webhooks.js';
import {
  ROLES, createApiKey, createObserver, createVpa, createWebhookEndpoint, observerIngestUrl, rotateObserverToken, validateWebhookInput,
} from '../lib/merchants.js';
import { attachObservation } from '../lib/matching.js';
import {
  cancelOrder, cancelPaymentLink, captureOrder, createOrder, createPaymentLink, createRefund, expireIfDue,
  failRefund, processRefund, rejectPayment,
} from '../lib/orders.js';
import * as S from '../lib/serialize.js';
import { paiseToRupees } from '../lib/money.js';

const RANGE_DAYS = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

function localDateKey(ts) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfLocalDay(daysAgo = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return Math.floor(d.getTime() / 1000);
}

function csvCell(v) {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const isoOrEmpty = (ts) => (ts ? new Date(ts * 1000).toISOString() : '');

export function dashboardRouter(ctx) {
  const { db } = ctx;
  const r = express.Router();

  r.use(requireSession(db));
  r.use(viewerReadOnly);

  const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});
  const qMode = (req) => parseMode(req.query.mode);
  const bMode = (req) => parseMode(body(req).mode ?? req.query.mode);
  const owned = (table, req, id = req.params.id) => {
    const row = one(db, `SELECT * FROM ${table} WHERE id=? AND merchant_id=?`, id, req.merchant.id);
    if (!row) throw notFound();
    return row;
  };
  const managers = requireRole('owner', 'admin');
  const refundManagers = requireRole('owner', 'admin');
  const merchantFresh = (req) => one(db, 'SELECT * FROM merchants WHERE id=?', req.merchant.id);
  const like = (q) => `%${String(q).replace(/[\\%_]/g, (c) => '\\' + c)}%`;

  // ---------------------------------------------------------------- summary
  r.get('/dashboard/summary', (req, res) => {
    const mode = qMode(req);
    const range = req.query.range || '7d';
    const days = RANGE_DAYS[range];
    if (!days) throw validation('range must be one of today, 7d, 30d, 90d', 'range');
    const m = req.merchant.id;
    const start = startOfLocalDay(days - 1);

    const agg = one(db, `SELECT COUNT(*) AS orders_count,
                           SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid_count,
                           SUM(CASE WHEN status='paid' THEN amount_paid ELSE 0 END) AS collected
                         FROM orders WHERE merchant_id=? AND mode=? AND created_at>=?`, m, mode, start);
    const ordersCount = agg.orders_count || 0;
    const paidCount = agg.paid_count || 0;
    const collected = agg.collected || 0;
    const pendingVerification = one(db, `SELECT COUNT(*) AS n FROM payments WHERE merchant_id=? AND mode=? AND status='pending_verification'`, m, mode).n;
    const unmatched = one(db, `SELECT COUNT(*) AS n FROM observations WHERE merchant_id=? AND mode=? AND status='unmatched'`, m, mode).n;
    const refunds = one(db, `SELECT COALESCE(SUM(amount),0) AS s FROM refunds WHERE merchant_id=? AND mode=? AND status<>'failed' AND created_at>=?`, m, mode, start).s;

    const byDay = new Map();
    for (const row of all(db, `SELECT created_at, amount_paid FROM orders WHERE merchant_id=? AND mode=? AND status='paid' AND created_at>=?`, m, mode, start)) {
      const k = localDateKey(row.created_at);
      const cur = byDay.get(k) || { amount: 0, count: 0 };
      cur.amount += row.amount_paid;
      cur.count += 1;
      byDay.set(k, cur);
    }
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const k = localDateKey(startOfLocalDay(i) + 3600);
      const v = byDay.get(k) || { amount: 0, count: 0 };
      series.push({ date: k, amount: v.amount, count: v.count });
    }

    const methodSplit = all(db, `SELECT COALESCE(upi_app,'other') AS upi_app, COUNT(*) AS count, SUM(amount) AS amount FROM payments
                                 WHERE merchant_id=? AND mode=? AND status='captured' AND created_at>=? GROUP BY COALESCE(upi_app,'other') ORDER BY amount DESC`, m, mode, start);
    const recent = all(db, 'SELECT * FROM orders WHERE merchant_id=? AND mode=? ORDER BY created_at DESC, rowid DESC LIMIT 8', m, mode);

    res.json({
      collected_amount: collected,
      orders_count: ordersCount,
      paid_count: paidCount,
      success_rate: ordersCount ? Math.round((paidCount / ordersCount) * 1000) / 10 : 0,
      pending_verification_count: pendingVerification,
      unmatched_observations_count: unmatched,
      refunds_amount: refunds,
      avg_ticket: paidCount ? Math.round(collected / paidCount) : 0,
      series,
      recent_orders: recent.map((o) => S.order(expireIfDue(db, o))),
      method_split: methodSplit.map((x) => ({ upi_app: x.upi_app, count: x.count, amount: x.amount || 0 })),
    });
  });

  // ---------------------------------------------------------------- orders
  r.get('/orders', (req, res) => {
    const where = ['merchant_id = ?', 'mode = ?'];
    const params = [req.merchant.id, qMode(req)];
    if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
    if (req.query.q) {
      const q = like(req.query.q);
      where.push(`(id LIKE ? ESCAPE '\\' OR receipt LIKE ? ESCAPE '\\' OR utr LIKE ? ESCAPE '\\' OR customer LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'
                   OR id IN (SELECT order_id FROM payments WHERE merchant_id = ? AND utr LIKE ? ESCAPE '\\'))`);
      params.push(q, q, q, q, q, req.merchant.id, q);
    }
    res.json(paginate(db, { table: 'orders', where, params, query: req.query, map: S.order }));
  });

  r.post('/orders', (req, res) => {
    const b = body(req);
    const merchant = merchantFresh(req);
    const description = optString(b, 'description', 255);
    const order = createOrder(db, merchant, bMode(req), {
      amount: b.amount, customer: b.customer, expire_in: b.expire_in, notes: b.notes, receipt: b.receipt, vpa_id: b.vpa_id,
    }, { description });
    res.status(201).json(S.order(order));
  });

  r.get('/orders/:id', (req, res) => {
    const o = expireIfDue(db, owned('orders', req));
    res.json({
      order: S.order(o),
      payments: all(db, 'SELECT * FROM payments WHERE order_id=? ORDER BY created_at DESC, rowid DESC', o.id).map(S.payment),
      refunds: all(db, 'SELECT * FROM refunds WHERE order_id=? ORDER BY created_at DESC, rowid DESC', o.id).map(S.refund),
      events: all(db, 'SELECT * FROM events WHERE order_id=? ORDER BY created_at DESC, rowid DESC', o.id).map(S.event),
      observations: all(db, 'SELECT * FROM observations WHERE order_id=? ORDER BY created_at DESC', o.id).map(S.observation),
    });
  });

  r.post('/orders/:id/mark-paid', (req, res) => {
    const o = owned('orders', req);
    const b = body(req);
    let utr = b.utr == null || b.utr === '' ? null : String(b.utr).trim();
    if (utr && !/^\d{12}$/.test(utr)) throw validation('UTR must be exactly 12 digits', 'utr');
    const note = optString(b, 'note', 500);
    // The merchant is authoritative: they may confirm an expired order, or one the customer cancelled after paying.
    const result = captureOrder(db, o.id, { verified_by: 'merchant', utr, flow: 'manual', allowExpired: true, allowCancelled: true });
    if (note) {
      const notes = JSON.parse(result.order.notes || '{}');
      notes.marked_paid_note = note;
      run(db, 'UPDATE orders SET notes=? WHERE id=?', JSON.stringify(notes), o.id);
    }
    res.json(S.order(one(db, 'SELECT * FROM orders WHERE id=?', o.id)));
  });

  r.post('/orders/:id/cancel', (req, res) => {
    const o = owned('orders', req);
    res.json(S.order(cancelOrder(db, o)));
  });

  // ---------------------------------------------------------------- payments
  r.get('/payments', (req, res) => {
    const where = ['merchant_id = ?', 'mode = ?'];
    const params = [req.merchant.id, qMode(req)];
    if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
    if (req.query.q) {
      const q = like(req.query.q);
      where.push(`(id LIKE ? ESCAPE '\\' OR order_id LIKE ? ESCAPE '\\' OR utr LIKE ? ESCAPE '\\' OR payer_vpa LIKE ? ESCAPE '\\')`);
      params.push(q, q, q, q);
    }
    res.json(paginate(db, { table: 'payments', where, params, query: req.query, map: S.payment }));
  });

  r.get('/payments/:id', (req, res) => res.json(S.payment(owned('payments', req))));

  r.post('/payments/:id/reject', (req, res) => {
    const p = owned('payments', req);
    const reason = optString(body(req), 'reason', 255);
    const { payment } = rejectPayment(db, p, reason);
    res.json(S.payment(payment));
  });

  // ---------------------------------------------------------------- refunds
  r.get('/refunds', (req, res) => {
    const where = ['merchant_id = ?', 'mode = ?'];
    const params = [req.merchant.id, qMode(req)];
    if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
    if (req.query.q) {
      const q = like(req.query.q);
      where.push(`(id LIKE ? ESCAPE '\\' OR payment_id LIKE ? ESCAPE '\\' OR order_id LIKE ? ESCAPE '\\' OR utr LIKE ? ESCAPE '\\')`);
      params.push(q, q, q, q);
    }
    res.json(paginate(db, { table: 'refunds', where, params, query: req.query, map: S.refund }));
  });

  r.post('/refunds', refundManagers, (req, res) => {
    const refund = createRefund(db, req.merchant, bMode(req), body(req), { anyMode: true });
    res.status(201).json(S.refund(refund));
  });

  r.post('/refunds/:id/process', refundManagers, (req, res) => {
    const x = owned('refunds', req);
    res.json(S.refund(processRefund(db, x, body(req).utr)));
  });

  r.post('/refunds/:id/fail', refundManagers, (req, res) => {
    const x = owned('refunds', req);
    res.json(S.refund(failRefund(db, x)));
  });

  // ---------------------------------------------------------------- payment links
  r.get('/payment-links', (req, res) => {
    const where = ['merchant_id = ?', 'mode = ?'];
    const params = [req.merchant.id, qMode(req)];
    if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
    if (req.query.q) {
      const q = like(req.query.q);
      where.push(`(id LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR reference_id LIKE ? ESCAPE '\\' OR customer LIKE ? ESCAPE '\\')`);
      params.push(q, q, q, q);
    }
    res.json(paginate(db, { table: 'payment_links', where, params, query: req.query, map: S.paymentLink }));
  });

  r.post('/payment-links', (req, res) => {
    res.status(201).json(S.paymentLink(createPaymentLink(db, merchantFresh(req), bMode(req), body(req))));
  });

  r.get('/payment-links/:id', (req, res) => res.json(S.paymentLink(owned('payment_links', req))));

  r.post('/payment-links/:id/cancel', (req, res) => {
    res.json(S.paymentLink(cancelPaymentLink(db, owned('payment_links', req))));
  });

  // ---------------------------------------------------------------- VPAs
  r.get('/vpas', (req, res) => {
    const rows = all(db, 'SELECT * FROM vpas WHERE merchant_id=? AND mode=? ORDER BY is_default DESC, created_at ASC', req.merchant.id, qMode(req));
    res.json(collection(rows.map(S.vpa)));
  });

  r.post('/vpas', (req, res) => {
    const b = body(req);
    const v = createVpa(db, req.merchant.id, bMode(req), {
      vpa: b.vpa, payee_name: b.payee_name || req.merchant.business_name, label: b.label ?? null, is_default: optBool(b, 'is_default'),
    });
    res.status(201).json(S.vpa(v));
  });

  r.patch('/vpas/:id', (req, res) => {
    const v = owned('vpas', req);
    const b = body(req);
    tx(db, () => {
      if (b.label !== undefined) {
        const label = optString(b, 'label', 64);
        run(db, 'UPDATE vpas SET label=? WHERE id=?', label, v.id);
      }
      if (b.payee_name !== undefined) {
        const pn = reqString(b, 'payee_name', 100);
        run(db, 'UPDATE vpas SET payee_name=? WHERE id=?', pn, v.id);
      }
      const active = optBool(b, 'active');
      if (active != null) run(db, 'UPDATE vpas SET active=? WHERE id=?', active ? 1 : 0, v.id);
      const isDefault = optBool(b, 'is_default');
      if (isDefault === true) {
        run(db, 'UPDATE vpas SET is_default=0 WHERE merchant_id=? AND mode=?', v.merchant_id, v.mode);
        run(db, 'UPDATE vpas SET is_default=1 WHERE id=?', v.id);
      } else if (isDefault === false && v.is_default) {
        const next = one(db, 'SELECT id FROM vpas WHERE merchant_id=? AND mode=? AND id<>? ORDER BY active DESC, created_at ASC LIMIT 1', v.merchant_id, v.mode, v.id);
        if (!next) throw badRequest('DEFAULT_VPA_REQUIRED', 'At least one UPI ID must remain the default', 'is_default');
        run(db, 'UPDATE vpas SET is_default=0 WHERE id=?', v.id);
        run(db, 'UPDATE vpas SET is_default=1 WHERE id=?', next.id);
      }
    });
    res.json(S.vpa(one(db, 'SELECT * FROM vpas WHERE id=?', v.id)));
  });

  r.delete('/vpas/:id', (req, res) => {
    const v = owned('vpas', req);
    tx(db, () => {
      run(db, 'DELETE FROM vpas WHERE id=?', v.id);
      if (v.is_default) {
        const next = one(db, 'SELECT id FROM vpas WHERE merchant_id=? AND mode=? ORDER BY active DESC, created_at ASC LIMIT 1', v.merchant_id, v.mode);
        if (next) run(db, 'UPDATE vpas SET is_default=1 WHERE id=?', next.id);
      }
    });
    res.json({ id: v.id, deleted: true });
  });

  // ---------------------------------------------------------------- API keys
  r.get('/api-keys', (req, res) => {
    const rows = all(db, 'SELECT * FROM api_keys WHERE merchant_id=? AND mode=? ORDER BY created_at DESC', req.merchant.id, qMode(req));
    res.json(collection(rows.map(S.apiKey)));
  });

  r.post('/api-keys', (req, res) => {
    const { row, secret } = createApiKey(db, req.merchant.id, bMode(req));
    res.status(201).json({ ...S.apiKey(row), key_id: row.id, key_secret: secret });
  });

  r.post('/api-keys/:id/revoke', (req, res) => {
    const k = owned('api_keys', req);
    if (k.status !== 'revoked') run(db, `UPDATE api_keys SET status='revoked', revoked_at=? WHERE id=?`, now(), k.id);
    res.json(S.apiKey(one(db, 'SELECT * FROM api_keys WHERE id=?', k.id)));
  });

  // ---------------------------------------------------------------- webhooks
  r.get('/webhooks', (req, res) => {
    const rows = all(db, 'SELECT * FROM webhook_endpoints WHERE merchant_id=? AND mode=? ORDER BY created_at DESC', req.merchant.id, qMode(req));
    res.json(collection(rows.map((x) => S.webhook(x))));
  });

  r.post('/webhooks', (req, res) => {
    const { row, secret } = createWebhookEndpoint(db, req.merchant.id, bMode(req), body(req));
    res.status(201).json(S.webhook(row, secret));
  });

  r.get('/webhooks/:id', (req, res) => res.json(S.webhook(owned('webhook_endpoints', req))));

  r.patch('/webhooks/:id', (req, res) => {
    const ep = owned('webhook_endpoints', req);
    const v = validateWebhookInput(body(req), { partial: true, mode: ep.mode });
    if (v.url !== undefined) run(db, 'UPDATE webhook_endpoints SET url=? WHERE id=?', v.url, ep.id);
    if (v.description !== undefined) run(db, 'UPDATE webhook_endpoints SET description=? WHERE id=?', v.description, ep.id);
    if (v.events !== undefined) run(db, 'UPDATE webhook_endpoints SET events=? WHERE id=?', JSON.stringify(v.events), ep.id);
    if (v.active !== undefined) run(db, 'UPDATE webhook_endpoints SET active=? WHERE id=?', v.active ? 1 : 0, ep.id);
    res.json(S.webhook(one(db, 'SELECT * FROM webhook_endpoints WHERE id=?', ep.id)));
  });

  r.delete('/webhooks/:id', (req, res) => {
    const ep = owned('webhook_endpoints', req);
    run(db, 'DELETE FROM webhook_endpoints WHERE id=?', ep.id);
    res.json({ id: ep.id, deleted: true });
  });

  r.post('/webhooks/:id/reveal-secret', (req, res) => {
    const ep = owned('webhook_endpoints', req);
    const secret = decrypt(ep.secret_enc);
    res.json({ ...S.webhook(ep, secret), secret });
  });

  r.post('/webhooks/:id/test', async (req, res) => {
    const ep = owned('webhook_endpoints', req);
    const d = await sendTestPing(db, ep);
    res.json(S.delivery(d));
  });

  r.get('/webhooks/:id/deliveries', (req, res) => {
    const ep = owned('webhook_endpoints', req);
    const where = ['endpoint_id = ?'];
    const params = [ep.id];
    if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
    res.json(paginate(db, { table: 'webhook_deliveries', where, params, query: req.query, map: S.delivery }));
  });

  r.post('/webhook-deliveries/:id/resend', async (req, res) => {
    const d = owned('webhook_deliveries', req);
    const fresh = await resendDelivery(db, d);
    res.json(S.delivery(fresh));
  });

  // ---------------------------------------------------------------- events
  r.get('/events', (req, res) => {
    const where = ['merchant_id = ?', 'mode = ?'];
    const params = [req.merchant.id, qMode(req)];
    if (req.query.type) { where.push('type = ?'); params.push(String(req.query.type)); }
    if (req.query.order_id) { where.push('order_id = ?'); params.push(String(req.query.order_id)); }
    res.json(paginate(db, { table: 'events', where, params, query: req.query, map: S.event }));
  });

  r.get('/events/:id', (req, res) => res.json(S.event(owned('events', req))));

  // ---------------------------------------------------------------- observers + observations
  r.get('/observers', (req, res) => {
    const rows = all(db, 'SELECT * FROM observers WHERE merchant_id=? AND mode=? ORDER BY created_at DESC', req.merchant.id, qMode(req));
    res.json(collection(rows.map(S.observer)));
  });

  r.post('/observers/test-parse', (req, res) => {
    const text = optString(body(req), 'text', 4000);
    if (!text) throw validation('text is required', 'text');
    res.json(parseSms(text));
  });

  r.post('/observers', (req, res) => {
    const name = optString(body(req), 'name', 64) || 'SMS forwarder';
    const { row, token } = createObserver(db, req.merchant.id, bMode(req), name);
    res.status(201).json({ ...S.observer(row), token, ingest_url: observerIngestUrl(token) });
  });

  r.delete('/observers/:id', (req, res) => {
    const o = owned('observers', req);
    run(db, 'DELETE FROM observers WHERE id=?', o.id);
    res.json({ id: o.id, deleted: true });
  });

  r.post('/observers/:id/rotate-token', (req, res) => {
    const o = owned('observers', req);
    const { row, token } = rotateObserverToken(db, o);
    res.json({ ...S.observer(row), token, ingest_url: observerIngestUrl(token) });
  });

  r.get('/observations', (req, res) => {
    const where = ['merchant_id = ?', 'mode = ?'];
    const params = [req.merchant.id, qMode(req)];
    if (req.query.status) { where.push('status = ?'); params.push(String(req.query.status)); }
    if (req.query.observer_id) { where.push('observer_id = ?'); params.push(String(req.query.observer_id)); }
    res.json(paginate(db, { table: 'observations', where, params, query: req.query, map: S.observation }));
  });

  r.post('/observations/:id/attach', (req, res) => {
    const obs = owned('observations', req);
    if (!['unmatched', 'ignored'].includes(obs.status)) throw badRequest('OBSERVATION_NOT_ATTACHABLE', `Observation is ${obs.status}`);
    if (obs.status === 'ignored' && obs.direction === 'debit') throw badRequest('OBSERVATION_NOT_ATTACHABLE', 'A debit cannot prove a payment');
    const orderId = optString(body(req), 'order_id', 64);
    if (!orderId) throw validation('order_id is required', 'order_id');
    const order = one(db, 'SELECT * FROM orders WHERE id=? AND merchant_id=? AND mode=?', orderId, req.merchant.id, obs.mode);
    if (!order) throw notFound('Order not found in this mode');
    const { order: o, payment } = attachObservation(db, obs, order.id, 'merchant');
    res.json({ observation: S.observation(one(db, 'SELECT * FROM observations WHERE id=?', obs.id)), order: S.order(o), payment: S.payment(payment) });
  });

  r.post('/observations/:id/ignore', (req, res) => {
    const obs = owned('observations', req);
    if (obs.status === 'matched') throw badRequest('OBSERVATION_ALREADY_MATCHED', 'Matched observations cannot be ignored');
    run(db, `UPDATE observations SET status='ignored' WHERE id=? AND status<>'matched'`, obs.id);
    res.json(S.observation(one(db, 'SELECT * FROM observations WHERE id=?', obs.id)));
  });

  // ---------------------------------------------------------------- settings
  r.get('/settings', (req, res) => res.json(S.settings(merchantFresh(req))));

  r.patch('/settings', (req, res) => {
    const b = body(req);
    const sets = [];
    const vals = [];
    const str = (name, max) => {
      if (b[name] === undefined) return;
      sets.push(`${name}=?`);
      vals.push(optString(b, name, max));
    };
    if (b.business_name !== undefined) { sets.push('business_name=?'); vals.push(reqString(b, 'business_name', 120)); }
    str('business_type', 64);
    str('phone', 20);
    str('support_email', 254);
    str('support_phone', 20);
    for (const f of ['phone', 'support_phone']) {
      if (b[f] && !/^\+?[0-9\- ]{6,20}$/.test(b[f])) throw validation(`${f} is invalid`, f);
    }
    str('website', 2048);
    str('logo_url', 2048);
    if (b.support_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.support_email)) throw validation('support_email is invalid', 'support_email');
    for (const f of ['website', 'logo_url']) {
      if (b[f]) {
        try { const u = new URL(b[f]); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); } catch { throw validation(`${f} must be an http(s) URL`, f); }
      }
    }
    if (b.brand_color !== undefined) {
      if (typeof b.brand_color !== 'string' || !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(b.brand_color)) throw validation('brand_color must be a hex colour like #5f259f', 'brand_color');
      sets.push('brand_color=?'); vals.push(b.brand_color);
    }
    if (b.order_expiry_seconds !== undefined) {
      sets.push('order_expiry_seconds=?'); vals.push(optInt(b, 'order_expiry_seconds', { min: 120, max: 86400 }) ?? 900);
    }
    for (const f of ['unique_amount', 'onboarding_completed']) {
      if (b[f] !== undefined) { sets.push(`${f}=?`); vals.push(optBool(b, f) ? 1 : 0); }
    }
    if (sets.length) run(db, `UPDATE merchants SET ${sets.join(', ')} WHERE id=?`, ...vals, req.merchant.id);
    res.json(S.settings(merchantFresh(req)));
  });

  r.post('/live/enable', managers, (req, res) => {
    const m = merchantFresh(req);
    const liveVpa = one(db, `SELECT id FROM vpas WHERE merchant_id=? AND mode='live' AND active=1 LIMIT 1`, m.id);
    if (!liveVpa) throw badRequest('LIVE_VPA_REQUIRED', 'Add at least one live UPI ID before enabling live mode');
    if (!m.business_name || !(m.phone || m.support_phone) || !(m.support_email)) {
      throw badRequest('BUSINESS_DETAILS_REQUIRED', 'Complete your business details (name, phone and support email) before enabling live mode');
    }
    run(db, 'UPDATE merchants SET live_enabled=1 WHERE id=?', m.id);
    res.json(S.merchantBrief(merchantFresh(req)));
  });

  // ---------------------------------------------------------------- team
  r.get('/team', (req, res) => {
    const rows = all(db, 'SELECT * FROM users WHERE merchant_id=? ORDER BY created_at ASC', req.merchant.id);
    res.json(collection(rows.map(S.user)));
  });

  const assignableRole = (req, role) => {
    if (!ROLES.includes(role) || role === 'owner') throw validation('role must be one of admin, developer, viewer', 'role');
    if (role === 'admin' && req.user.role !== 'owner') throw forbidden('FORBIDDEN', 'Only the owner can grant the admin role');
    return role;
  };

  r.post('/team', managers, async (req, res) => {
    const b = body(req);
    const name = reqString(b, 'name', 100);
    const email = reqString(b, 'email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw validation('Enter a valid email address', 'email');
    const role = assignableRole(req, b.role);
    const password = typeof b.password === 'string' ? b.password : '';
    if (password.length < 8) throw validation('Password must be at least 8 characters', 'password');
    if (password.length > 200) throw validation('Password is too long', 'password');
    if (one(db, 'SELECT id FROM users WHERE email=?', email)) throw conflict('EMAIL_TAKEN', 'A user with this email already exists', 'email');
    const hash = await hashPassword(password);
    const id = ids.user();
    tx(db, () => {
      // Re-check after the async hash: a concurrent request may have taken the email meanwhile.
      if (one(db, 'SELECT id FROM users WHERE email=?', email)) throw conflict('EMAIL_TAKEN', 'A user with this email already exists', 'email');
      run(db, 'INSERT INTO users (id, merchant_id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?,?)',
        id, req.merchant.id, name, email, hash, role, now());
    });
    res.status(201).json(S.user(one(db, 'SELECT * FROM users WHERE id=?', id)));
  });

  r.patch('/team/:id', managers, (req, res) => {
    const u = owned('users', req);
    if (u.role === 'owner') throw forbidden('FORBIDDEN', "The owner's role cannot be changed");
    if (u.id === req.user.id) throw forbidden('FORBIDDEN', 'You cannot change your own role');
    if (u.role === 'admin' && req.user.role !== 'owner') throw forbidden('FORBIDDEN', 'Only the owner can modify admins');
    const role = assignableRole(req, body(req).role);
    run(db, 'UPDATE users SET role=? WHERE id=?', role, u.id);
    res.json(S.user(one(db, 'SELECT * FROM users WHERE id=?', u.id)));
  });

  r.delete('/team/:id', managers, (req, res) => {
    const u = owned('users', req);
    if (u.role === 'owner') throw forbidden('FORBIDDEN', 'The owner cannot be removed');
    if (u.id === req.user.id) throw forbidden('FORBIDDEN', 'You cannot remove yourself');
    if (u.role === 'admin' && req.user.role !== 'owner') throw forbidden('FORBIDDEN', 'Only the owner can remove admins');
    run(db, 'DELETE FROM users WHERE id=?', u.id);
    res.json({ id: u.id, deleted: true });
  });

  // ---------------------------------------------------------------- reports
  r.get('/reports/export', (req, res) => {
    const mode = qMode(req);
    const type = req.query.type || 'orders';
    const where = ['merchant_id = ?', 'mode = ?'];
    const params = [req.merchant.id, mode];
    const from = optInt(req.query, 'from', { min: 0 });
    const to = optInt(req.query, 'to', { min: 0 });
    if (from != null) { where.push('created_at >= ?'); params.push(from); }
    if (to != null) { where.push('created_at <= ?'); params.push(to); }
    const sqlWhere = where.join(' AND ');
    let header;
    let rows;
    if (type === 'orders') {
      header = ['id', 'created_at', 'status', 'amount_inr', 'amount_payable_inr', 'amount_paid_inr', 'receipt', 'description', 'vpa', 'utr', 'customer_name', 'customer_email', 'customer_phone', 'paid_at', 'expires_at', 'notes'];
      rows = all(db, `SELECT * FROM orders WHERE ${sqlWhere} ORDER BY created_at DESC LIMIT 100000`, ...params).map((o) => {
        const c = S.customerOf(o.customer);
        return [o.id, isoOrEmpty(o.created_at), o.status, paiseToRupees(o.amount), paiseToRupees(o.amount_payable), paiseToRupees(o.amount_paid),
          o.receipt, o.description, o.vpa, o.utr, c.name, c.email, c.phone, isoOrEmpty(o.paid_at), isoOrEmpty(o.expires_at), o.notes];
      });
    } else if (type === 'payments') {
      header = ['id', 'order_id', 'created_at', 'status', 'amount_inr', 'flow', 'upi_app', 'utr', 'payer_vpa', 'verified_by', 'error_code', 'captured_at'];
      rows = all(db, `SELECT * FROM payments WHERE ${sqlWhere} ORDER BY created_at DESC LIMIT 100000`, ...params).map((p) =>
        [p.id, p.order_id, isoOrEmpty(p.created_at), p.status, paiseToRupees(p.amount), p.flow, p.upi_app, p.utr, p.payer_vpa, p.verified_by, p.error_code, isoOrEmpty(p.captured_at)]);
    } else if (type === 'refunds') {
      header = ['id', 'payment_id', 'order_id', 'created_at', 'status', 'amount_inr', 'utr', 'processed_at', 'notes'];
      rows = all(db, `SELECT * FROM refunds WHERE ${sqlWhere} ORDER BY created_at DESC LIMIT 100000`, ...params).map((x) =>
        [x.id, x.payment_id, x.order_id, isoOrEmpty(x.created_at), x.status, paiseToRupees(x.amount), x.utr, isoOrEmpty(x.processed_at), x.notes]);
    } else {
      throw validation('type must be one of orders, payments, refunds', 'type');
    }
    const csv = [header, ...rows].map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const stamp = new Date().toISOString().slice(0, 10);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="opengateway-${type}-${mode}-${stamp}.csv"`);
    res.send(csv);
  });

  // ---------------------------------------------------------------- API logs
  r.get('/api-logs', (req, res) => {
    const rows = all(db, 'SELECT * FROM api_logs WHERE merchant_id=? AND mode=? ORDER BY created_at DESC, rowid DESC LIMIT 500', req.merchant.id, qMode(req));
    res.json(collection(rows.map(S.apiLog)));
  });

  // Unknown /api route
  r.use((req, res, next) => next(notFound(`No route ${req.method} ${req.originalUrl.split('?')[0]}`)));

  return r;
}
