/** Public checkout API — /api/checkout/:ps (the session id is the capability). */
import express from 'express';
import { one, now } from '../db.js';
import { notFound } from '../lib/errors.js';
import { buildUpiUri } from '../lib/upi.js';
import * as S from '../lib/serialize.js';
import { clientIp } from '../lib/http.js';
import { matchOrderToRecentObservation } from '../lib/matching.js';
import {
  attemptPayment, buildRedirectUrl, cancelOrder, confirmPayment, expireIfDue, getMerchant, getOrderBySession,
  latestPayment, openPayment, returnParams, simulateOutcome,
} from '../lib/orders.js';

export function checkoutRouter(ctx) {
  const { db, limiters } = ctx;
  const r = express.Router();

  // Generous per-IP limit on every checkout call (the page polls /status every 2 s).
  r.use(limiters.checkout.middleware((req) => `checkout:${clientIp(req)}`));

  const load = (req) => {
    if (!/^ps_[0-9A-Za-z]{24}$/.test(req.params.ps)) throw notFound('Checkout session not found', 'SESSION_NOT_FOUND');
    const o = getOrderBySession(db, req.params.ps);
    if (!o) throw notFound('Checkout session not found', 'SESSION_NOT_FOUND');
    return expireIfDue(db, o);
  };
  const currentPayment = (o) => openPayment(db, o.id) || latestPayment(db, o.id);
  const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

  r.get('/:ps', (req, res) => {
    const o = load(req);
    const m = getMerchant(db, o.merchant_id);
    const c = S.customerOf(o.customer);
    res.json({
      order: {
        id: o.id,
        amount: o.amount,
        amount_payable: o.amount_payable,
        currency: o.currency,
        status: o.status,
        receipt: o.receipt ?? null,
        description: o.description ?? null,
        expires_at: o.expires_at,
        customer: c,
      },
      merchant: {
        name: m.business_name,
        logo_url: S.safeHttpUrl(m.logo_url),
        brand_color: S.safeColor(m.brand_color),
        support_email: m.support_email ?? null,
        support_phone: m.support_phone ?? null,
      },
      upi: {
        vpa: o.vpa,
        payee_name: o.payee_name,
        uri: buildUpiUri({ vpa: o.vpa, payeeName: o.payee_name, amount: o.amount_payable, note: o.description || o.id, ref: o.id }),
      },
      payment: S.payment(currentPayment(o)),
      mode: o.mode,
      return_url: o.return_url ?? null,
      server_time: now(),
    });
  });

  r.post('/:ps/attempt', (req, res) => {
    const o = load(req);
    const { flow, upi_app } = body(req);
    const { payment } = attemptPayment(db, o, { flow, upi_app });
    res.json(S.payment(payment));
  });

  r.post('/:ps/confirm', limiters.confirm.middleware((req) => `confirm:${clientIp(req)}`), (req, res) => {
    const o = load(req);
    const confirmed = confirmPayment(db, o, { utr: body(req).utr });
    // Settle immediately only if an *observed* credit proves it; the customer's word alone never captures.
    const { order, payment } = matchOrderToRecentObservation(db, confirmed.order, confirmed.payment) || confirmed;
    res.json({ status: order.status, payment: S.payment(payment) });
  });

  r.get('/:ps/status', (req, res) => {
    const o = load(req);
    const p = currentPayment(o);
    const params = returnParams(db, o);
    res.json({
      order_status: o.status,
      payment_status: p?.status ?? null,
      redirect_url: buildRedirectUrl(db, o),
      expires_at: o.expires_at,
      server_time: now(),
      // Same fields as the redirect query (for modal-mode postMessage when there's no return_url).
      result: params,
    });
  });

  r.post('/:ps/cancel', (req, res) => {
    const o = load(req);
    const order = cancelOrder(db, o, { code: 'USER_CANCELLED', description: 'The customer cancelled the payment' });
    res.json({ order_status: order.status, redirect_url: buildRedirectUrl(db, order), result: returnParams(db, order) });
  });

  r.post('/:ps/simulate', (req, res) => {
    const o = load(req);
    const order = simulateOutcome(db, o, body(req).outcome);
    res.json({ order_status: order.status, payment: S.payment(currentPayment(order)), redirect_url: buildRedirectUrl(db, order), result: returnParams(db, order) });
  });

  return r;
}

export function publicRouter(ctx) {
  const { db } = ctx;
  const r = express.Router();
  r.get('/links/:code', (req, res) => {
    if (!/^[0-9A-Za-z]{1,32}$/.test(req.params.code)) throw notFound('Payment link not found');
    let link = one(db, 'SELECT * FROM payment_links WHERE code=?', req.params.code);
    if (!link) throw notFound('Payment link not found');
    if (link.status === 'active' && link.expire_by && link.expire_by <= now()) {
      db.prepare(`UPDATE payment_links SET status='expired' WHERE id=?`).run(link.id);
      link = one(db, 'SELECT * FROM payment_links WHERE id=?', link.id);
    }
    const m = getMerchant(db, link.merchant_id);
    res.json({
      status: link.status,
      amount: link.amount,
      description: link.description ?? null,
      merchant: { name: m.business_name, logo_url: S.safeHttpUrl(m.logo_url), brand_color: S.safeColor(m.brand_color) },
    });
  });
  return r;
}
