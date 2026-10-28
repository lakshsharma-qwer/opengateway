/** Order / payment / refund / payment-link domain logic. */
import { one, all, run, tx, now } from '../db.js';
import { ids } from './ids.js';
import { badRequest, conflict, forbidden, notFound, validation } from './errors.js';
import { emitEvent } from './events.js';
import { randomInt } from 'node:crypto';
import { decrypt, hmacHex } from './crypto.js';
import * as S from './serialize.js';
import { runtime } from '../config.js';
import {
  amountField, customerField, notesField, optInt, optString, urlField,
} from './http.js';

export const OPEN_STATUSES = ['created', 'attempted'];
export const UPI_APPS = ['gpay', 'phonepe', 'paytm', 'bhim', 'cred', 'other'];
export const UNIQUE_AMOUNT_SLOTS = 100;
/**
 * Late-credit grace window. A bank SMS can arrive minutes after the customer paid, so:
 *  - an order that expired less than this long ago can still be captured by an observed credit, and
 *  - the amount_payable "slot" of an order that left the open state (expired, cancelled, paid) stays
 *    reserved for this long, so a late SMS can never be attributed to a *different* new order.
 */
export const LATE_CREDIT_GRACE_SECONDS = 900;

export const getMerchant = (db, id) => one(db, 'SELECT * FROM merchants WHERE id = ?', id);
export const getOrder = (db, id) => one(db, 'SELECT * FROM orders WHERE id = ?', id);
export const getPayment = (db, id) => one(db, 'SELECT * FROM payments WHERE id = ?', id);
export const getOrderBySession = (db, ps) => one(db, 'SELECT * FROM orders WHERE payment_session_id = ?', ps);

export const isOpen = (o, t = now()) => OPEN_STATUSES.includes(o.status) && o.expires_at > t;

/** The current non-failed, non-captured payment on an order, if any. */
export const openPayment = (db, orderId) =>
  one(db, `SELECT * FROM payments WHERE order_id=? AND status IN ('created','pending_verification') ORDER BY created_at DESC, rowid DESC LIMIT 1`, orderId);
export const latestPayment = (db, orderId) =>
  one(db, 'SELECT * FROM payments WHERE order_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1', orderId);

// ---------------------------------------------------------------------------
// VPA resolution + unique amount

export function resolveVpa(db, merchantId, mode, vpaId) {
  if (vpaId) {
    const v = one(db, 'SELECT * FROM vpas WHERE id=? AND merchant_id=? AND mode=?', vpaId, merchantId, mode);
    if (!v) throw validation('vpa_id does not exist in this mode', 'vpa_id');
    if (!v.active) throw validation('vpa_id is not active', 'vpa_id');
    return v;
  }
  const v = one(db, 'SELECT * FROM vpas WHERE merchant_id=? AND mode=? AND active=1 ORDER BY is_default DESC, created_at ASC LIMIT 1', merchantId, mode);
  if (!v) throw badRequest('NO_VPA_CONFIGURED', `No active UPI ID is configured for ${mode} mode. Add one in Settings → UPI.`);
  return v;
}

/**
 * SQL predicate: the order still "holds" its amount_payable slot at time ?1 - grace — it is open (or overdue but
 * within the grace window), or it left the open state less than LATE_CREDIT_GRACE_SECONDS ago.
 * Bind one parameter: graceStart = now - LATE_CREDIT_GRACE_SECONDS.
 */
export const HOLDS_SLOT_SQL = `((status IN ('created','attempted') AND expires_at > ?1)
  OR (status IN ('paid','expired','cancelled') AND COALESCE(closed_at, updated_at) > ?1))`;

/**
 * Pick amount_payable: the first of amount, amount+1, ... amount+99 paise that no other order of this
 * merchant (same mode, any VPA — one observer phone can't tell VPAs apart) holds. See HOLDS_SLOT_SQL.
 */
export function pickPayableAmount(db, { merchantId, mode, amount, unique }) {
  if (!unique) return amount;
  const graceStart = now() - LATE_CREDIT_GRACE_SECONDS;
  const busy = new Set(
    all(db, `SELECT amount_payable FROM orders WHERE merchant_id=?2 AND mode=?3 AND amount_payable BETWEEN ?4 AND ?5
             AND ${HOLDS_SLOT_SQL}`,
      graceStart, merchantId, mode, amount, amount + UNIQUE_AMOUNT_SLOTS - 1).map((r) => r.amount_payable),
  );
  for (let i = 0; i < UNIQUE_AMOUNT_SLOTS; i++) if (!busy.has(amount + i)) return amount + i;
  throw conflict('VPA_BUSY', 'Too many open orders for this amount on this UPI ID. Try again in a few minutes or use another UPI ID.');
}

// ---------------------------------------------------------------------------
// Orders

/**
 * Create an order. `input` is the raw request body (validated here).
 * `extra` allows internal callers to set payment_link_id / description / return_url.
 */
export function createOrder(db, merchant, mode, input, extra = {}) {
  const amount = amountField(input, 'amount');
  if (input.currency != null && input.currency !== 'INR') throw validation('currency must be INR', 'currency');
  const receipt = optString(input, 'receipt', 40);
  const notes = notesField(input, 'notes');
  const customer = customerField(input, 'customer');
  const description = extra.description !== undefined ? extra.description : optString(input, 'description', 255);
  const expireIn = optInt(input, 'expire_in', { min: 120, max: 86400 }) ?? merchant.order_expiry_seconds;
  const returnUrl = extra.return_url !== undefined ? extra.return_url : urlField(input, 'return_url');
  const vpaId = input.vpa_id != null ? optString(input, 'vpa_id', 64) : null;

  return tx(db, () => {
    const v = resolveVpa(db, merchant.id, mode, vpaId);
    const payable = pickPayableAmount(db, { merchantId: merchant.id, mode, amount, unique: !!merchant.unique_amount });
    const id = ids.order();
    const t = now();
    run(db, `INSERT INTO orders (id, merchant_id, mode, amount, amount_payable, amount_paid, currency, receipt, notes, customer, description,
               status, vpa_id, vpa, payee_name, payment_session_id, return_url, payment_link_id, expires_at, created_at, updated_at)
             VALUES (?,?,?,?,?,0,'INR',?,?,?,?,'created',?,?,?,?,?,?,?,?,?)`,
      id, merchant.id, mode, amount, payable, receipt, JSON.stringify(notes), JSON.stringify(customer), description,
      v.id, v.vpa, v.payee_name, ids.session(), returnUrl, extra.payment_link_id ?? null, t + expireIn, t, t);
    return getOrder(db, id);
  });
}

function createPayment(db, order, { flow = 'qr', upi_app = null, status = 'created' } = {}) {
  const id = ids.payment();
  const t = now();
  run(db, `INSERT INTO payments (id, merchant_id, mode, order_id, amount, currency, status, method, flow, upi_app, created_at, updated_at)
           VALUES (?,?,?,?,?,'INR',?,'upi',?,?,?,?)`,
    id, order.merchant_id, order.mode, order.id, order.amount_payable, status, flow, upi_app, t, t);
  return getPayment(db, id);
}

function failPayment(db, p, code, description) {
  run(db, `UPDATE payments SET status='failed', error_code=?, error_description=?, updated_at=? WHERE id=?`, code, description, now(), p.id);
  return getPayment(db, p.id);
}

const ev = (db, order, type, data, paymentId = null) =>
  emitEvent(db, { merchantId: order.merchant_id, mode: order.mode, type, data, orderId: order.id, paymentId });

/** Expire an order if its expiry has passed. Returns the (possibly updated) row. */
export function expireIfDue(db, order) {
  if (!order || !OPEN_STATUSES.includes(order.status) || order.expires_at > now()) return order;
  return expireOrder(db, order);
}

export function expireOrder(db, order) {
  return tx(db, () => {
    const cur = getOrder(db, order.id);
    if (!OPEN_STATUSES.includes(cur.status)) return cur;
    const t = now();
    run(db, `UPDATE orders SET status='expired', closed_at=?, updated_at=? WHERE id=?`, Math.min(cur.expires_at, t), t, cur.id);
    const failed = [];
    for (const p of all(db, `SELECT * FROM payments WHERE order_id=? AND status IN ('created','pending_verification')`, cur.id)) {
      failed.push(failPayment(db, p, 'ORDER_EXPIRED', 'The order expired before the payment was verified'));
    }
    const o = getOrder(db, cur.id);
    for (const p of failed) ev(db, o, 'payment.failed', { payment: S.payment(p), order: S.order(o) }, p.id);
    ev(db, o, 'order.expired', { order: S.order(o) });
    return o;
  });
}

/** Expire overdue orders and payment links. Returns number of orders expired. */
export function expireDue(db) {
  const t = now();
  const due = all(db, `SELECT * FROM orders WHERE status IN ('created','attempted') AND expires_at <= ? LIMIT 500`, t);
  for (const o of due) expireOrder(db, o);
  run(db, `UPDATE payment_links SET status='expired' WHERE status='active' AND expire_by IS NOT NULL AND expire_by <= ?`, t);
  return due.length;
}

export function cancelOrder(db, order, { code = 'ORDER_CANCELLED', description = 'The order was cancelled by the merchant' } = {}) {
  expireIfDue(db, getOrder(db, order.id));
  return tx(db, () => {
    const cur = getOrder(db, order.id);
    if (!OPEN_STATUSES.includes(cur.status)) {
      throw badRequest('ORDER_NOT_CANCELLABLE', `Order is ${cur.status} and can no longer be cancelled`);
    }
    run(db, `UPDATE orders SET status='cancelled', closed_at=?, updated_at=? WHERE id=?`, now(), now(), cur.id);
    const failed = all(db, `SELECT * FROM payments WHERE order_id=? AND status IN ('created','pending_verification')`, cur.id)
      .map((p) => failPayment(db, p, code, description));
    const o = getOrder(db, cur.id);
    for (const p of failed) ev(db, o, 'payment.failed', { payment: S.payment(p), order: S.order(o) }, p.id);
    ev(db, o, 'order.cancelled', { order: S.order(o), payment: failed[0] ? S.payment(failed[0]) : null }, failed[0]?.id);
    return o;
  });
}

/** Is this UTR already on a captured payment (other than on `orderId`)? Live mode: across all merchants. */
export function utrAlreadyCaptured(db, { merchantId, mode, utr, orderId }) {
  if (!utr) return false;
  const row = mode === 'live'
    ? one(db, `SELECT id FROM payments WHERE mode='live' AND utr=? AND status='captured' AND order_id<>? LIMIT 1`, utr, orderId)
    : one(db, `SELECT id FROM payments WHERE merchant_id=? AND mode=? AND utr=? AND status='captured' AND order_id<>? LIMIT 1`, merchantId, mode, utr, orderId);
  return !!row;
}

/**
 * Capture an order: payment -> captured, order -> paid, events fire.
 * Runs in a BEGIN IMMEDIATE transaction and re-reads the order inside it, so concurrent captures
 * (two SMS, SMS + mark-paid, ...) can never both succeed: the loser gets 409 ORDER_ALREADY_PAID.
 * opts: { verified_by, utr, payer_vpa, observation_id, flow, upi_app,
 *         allowExpired (late credit within grace / merchant), allowCancelled (merchant only), amount (observed paise) }
 */
export function captureOrder(db, orderId, opts) {
  return tx(db, () => {
    const order = getOrder(db, orderId);
    if (!order) throw notFound('Order not found');
    if (order.status === 'paid') throw conflict('ORDER_ALREADY_PAID', 'Order is already paid');
    if (order.status === 'cancelled' && !opts.allowCancelled) throw badRequest('ORDER_NOT_PAYABLE', 'Order is cancelled');
    if (order.status === 'expired' && !opts.allowExpired) throw badRequest('ORDER_NOT_PAYABLE', 'Order has expired');
    if (utrAlreadyCaptured(db, { merchantId: order.merchant_id, mode: order.mode, utr: opts.utr, orderId: order.id })) {
      throw conflict('UTR_ALREADY_USED', 'This UTR has already been used for another payment', 'utr');
    }
    let p = openPayment(db, order.id) || createPayment(db, order, { flow: opts.flow || 'manual', upi_app: opts.upi_app ?? null });
    const t = now();
    run(db, `UPDATE payments SET status='captured', verified_by=?, utr=COALESCE(?, utr), payer_vpa=COALESCE(?, payer_vpa),
               observation_id=COALESCE(?, observation_id), amount=COALESCE(?, amount), error_code=NULL, error_description=NULL,
               captured_at=?, updated_at=? WHERE id=?`,
      opts.verified_by, opts.utr ?? null, opts.payer_vpa ?? null, opts.observation_id ?? null,
      Number.isSafeInteger(opts.amount) && opts.amount > 0 ? opts.amount : null, t, t, p.id);
    p = getPayment(db, p.id);
    run(db, `UPDATE orders SET status='paid', amount_paid=?, utr=?, paid_at=?, closed_at=?, updated_at=? WHERE id=?`, p.amount, p.utr, t, t, t, order.id);
    const o = getOrder(db, order.id);
    ev(db, o, 'payment.captured', { payment: S.payment(p), order: S.order(o) }, p.id);
    ev(db, o, 'order.paid', { order: S.order(o), payment: S.payment(p) }, p.id);
    if (o.payment_link_id) {
      const link = one(db, 'SELECT * FROM payment_links WHERE id=?', o.payment_link_id);
      if (link && link.status !== 'paid') {
        run(db, `UPDATE payment_links SET status='paid', paid_at=?, order_id=? WHERE id=?`, t, o.id, link.id);
        const l = one(db, 'SELECT * FROM payment_links WHERE id=?', link.id);
        ev(db, o, 'payment_link.paid', { payment_link: S.paymentLink(l), order: S.order(o), payment: S.payment(p) }, p.id);
      }
    }
    return { order: o, payment: p };
  });
}

// ---------------------------------------------------------------------------
// Checkout actions

function requireOpen(db, order) {
  const o = order;
  if (!isOpen(o)) throw badRequest('ORDER_NOT_PAYABLE', `Order is ${o.status} and cannot be paid`);
  return o;
}

export function attemptPayment(db, order, { flow, upi_app }) {
  if (flow != null && !['qr', 'intent'].includes(flow)) throw validation('flow must be "qr" or "intent"', 'flow');
  if (upi_app != null && upi_app !== '' && !UPI_APPS.includes(upi_app)) throw validation(`upi_app must be one of ${UPI_APPS.join(', ')}`, 'upi_app');
  expireIfDue(db, getOrder(db, order.id));
  return tx(db, () => {
    const o = requireOpen(db, getOrder(db, order.id));
    let p = openPayment(db, o.id);
    if (p) {
      if (p.status === 'created' && (flow || upi_app)) {
        run(db, 'UPDATE payments SET flow=COALESCE(?, flow), upi_app=COALESCE(?, upi_app), updated_at=? WHERE id=?', flow || null, upi_app || null, now(), p.id);
        p = getPayment(db, p.id);
      }
    } else {
      p = createPayment(db, o, { flow: flow || 'qr', upi_app: upi_app || null });
    }
    if (o.status === 'created') run(db, `UPDATE orders SET status='attempted', updated_at=? WHERE id=?`, now(), o.id);
    return { order: getOrder(db, o.id), payment: p };
  });
}

export function confirmPayment(db, order, { utr }) {
  if (utr != null && utr !== '') {
    utr = String(utr).trim();
    if (!/^\d{12}$/.test(utr)) throw validation('UTR must be exactly 12 digits', 'utr');
  } else utr = null;
  expireIfDue(db, getOrder(db, order.id));
  const result = tx(db, () => {
    const o = requireOpen(db, getOrder(db, order.id));
    if (utr) {
      const used = one(db, `SELECT id FROM payments WHERE merchant_id=? AND mode=? AND utr=? AND status IN ('captured','pending_verification') AND order_id<>?`,
        o.merchant_id, o.mode, utr, o.id);
      if (used) throw conflict('UTR_ALREADY_USED', 'This UTR has already been submitted for another payment', 'utr');
    }
    let p = openPayment(db, o.id) || createPayment(db, o, { flow: 'qr' });
    const changed = p.status !== 'pending_verification' || (utr && utr !== p.utr);
    run(db, `UPDATE payments SET status='pending_verification', utr=COALESCE(?, utr), updated_at=? WHERE id=?`, utr, now(), p.id);
    if (o.status === 'created') run(db, `UPDATE orders SET status='attempted', updated_at=? WHERE id=?`, now(), o.id);
    p = getPayment(db, p.id);
    const fresh = getOrder(db, o.id);
    if (changed) ev(db, fresh, 'payment.pending_verification', { payment: S.payment(p), order: S.order(fresh) }, p.id);
    return { order: fresh, payment: p };
  });
  return result;
}

export function simulateOutcome(db, order, outcome) {
  if (order.mode !== 'test') throw forbidden('TEST_MODE_ONLY', 'Simulation is only available in test mode');
  if (!['success', 'failure'].includes(outcome)) throw validation('outcome must be "success" or "failure"', 'outcome');
  expireIfDue(db, getOrder(db, order.id));
  return tx(db, () => {
    const o = requireOpen(db, getOrder(db, order.id));
    if (outcome === 'success') {
      // Random fake UTR (a timestamp-based one collided when two simulations ran in the same millisecond).
      const utr = `9${String(randomInt(0, 1e11)).padStart(11, '0')}`;
      return captureOrder(db, o.id, { verified_by: 'simulator', utr, payer_vpa: 'success@simulator', flow: 'qr' }).order;
    }
    const p = openPayment(db, o.id) || createPayment(db, o, { flow: 'qr' });
    const failed = failPayment(db, p, 'SIMULATED_FAILURE', 'Payment failure simulated in test mode');
    if (o.status === 'created') run(db, `UPDATE orders SET status='attempted', updated_at=? WHERE id=?`, now(), o.id);
    const fresh = getOrder(db, o.id);
    ev(db, fresh, 'payment.failed', { payment: S.payment(failed), order: S.order(fresh) }, failed.id);
    return fresh;
  });
}

export function rejectPayment(db, payment, reason) {
  return tx(db, () => {
    const p = getPayment(db, payment.id);
    if (!['created', 'pending_verification'].includes(p.status)) {
      throw badRequest('PAYMENT_NOT_REJECTABLE', `Payment is ${p.status} and cannot be rejected`);
    }
    const failed = failPayment(db, p, 'MERCHANT_REJECTED', reason || 'Rejected by merchant');
    let o = getOrder(db, p.order_id);
    if (o.status === 'created' || o.status === 'attempted') {
      if (o.expires_at > now()) run(db, `UPDATE orders SET status='attempted', updated_at=? WHERE id=?`, now(), o.id);
      o = getOrder(db, o.id);
    }
    ev(db, o, 'payment.failed', { payment: S.payment(failed), order: S.order(o) }, failed.id);
    const after = expireIfDue(db, o);
    return { payment: failed, order: after };
  });
}

// ---------------------------------------------------------------------------
// Checkout signature + return URL

export function activeKey(db, merchantId, mode) {
  return one(db, `SELECT * FROM api_keys WHERE merchant_id=? AND mode=? AND status='active' ORDER BY created_at DESC LIMIT 1`, merchantId, mode);
}

export function checkoutSignature(db, order, paymentId) {
  const key = activeKey(db, order.merchant_id, order.mode);
  if (!key) return null;
  return hmacHex(decrypt(key.secret_enc), `${order.id}|${paymentId}`);
}

/** Terminal checkout status for an order, or null while still in progress. */
export function terminalStatus(db, order) {
  if (order.status === 'paid') return 'paid';
  if (order.status === 'expired' || order.status === 'cancelled') return order.status;
  const lp = latestPayment(db, order.id);
  if (lp && lp.status === 'failed') return 'failed';
  return null;
}

export function returnParams(db, order) {
  const status = terminalStatus(db, order);
  if (!status) return null;
  const params = { og_order_id: order.id };
  if (status === 'paid') {
    const p = one(db, `SELECT * FROM payments WHERE order_id=? AND status='captured' ORDER BY captured_at DESC LIMIT 1`, order.id);
    params.og_payment_id = p?.id;
    params.og_status = 'paid';
    const sig = p ? checkoutSignature(db, order, p.id) : null;
    if (sig) params.og_signature = sig;
  } else {
    params.og_status = status;
  }
  return params;
}

export function buildRedirectUrl(db, order) {
  if (!order.return_url) return null;
  const params = returnParams(db, order);
  if (!params) return null;
  const u = new URL(order.return_url);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  return u.toString();
}

// ---------------------------------------------------------------------------
// Refunds

export function createRefund(db, merchant, mode, input, { anyMode = false } = {}) {
  const paymentId = optString(input, 'payment_id', 64);
  if (!paymentId) throw validation('payment_id is required', 'payment_id');
  const notes = notesField(input, 'notes');
  return tx(db, () => {
    const p = anyMode
      ? one(db, 'SELECT * FROM payments WHERE id=? AND merchant_id=?', paymentId, merchant.id)
      : one(db, 'SELECT * FROM payments WHERE id=? AND merchant_id=? AND mode=?', paymentId, merchant.id, mode);
    if (!p) throw notFound('Payment not found');
    if (p.status !== 'captured') throw badRequest('PAYMENT_NOT_CAPTURED', 'Only captured payments can be refunded', 'payment_id');
    const refunded = one(db, `SELECT COALESCE(SUM(amount),0) AS s FROM refunds WHERE payment_id=? AND status<>'failed'`, p.id).s;
    const remaining = p.amount - refunded;
    const amount = amountField(input, 'amount', { min: 1, max: 10_000_000, required: false }) ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw badRequest('REFUND_AMOUNT_EXCEEDED', `Refund amount exceeds the refundable balance of ${remaining} paise`, 'amount');
    }
    const id = ids.refund();
    run(db, `INSERT INTO refunds (id, merchant_id, mode, payment_id, order_id, amount, currency, status, notes, created_at)
             VALUES (?,?,?,?,?,?,'INR','pending',?,?)`, id, merchant.id, p.mode, p.id, p.order_id, amount, JSON.stringify(notes), now());
    const r = one(db, 'SELECT * FROM refunds WHERE id=?', id);
    emitEvent(db, { merchantId: merchant.id, mode: p.mode, type: 'refund.created', data: { refund: S.refund(r), payment: S.payment(p) }, orderId: p.order_id, paymentId: p.id });
    return r;
  });
}

export function processRefund(db, refund, utr) {
  if (utr != null && utr !== '' && !/^[A-Za-z0-9]{6,35}$/.test(String(utr))) throw validation('utr is invalid', 'utr');
  return tx(db, () => {
    const r = one(db, 'SELECT * FROM refunds WHERE id=?', refund.id);
    if (r.status !== 'pending') throw badRequest('REFUND_NOT_PENDING', `Refund is already ${r.status}`);
    run(db, `UPDATE refunds SET status='processed', utr=?, processed_at=? WHERE id=?`, utr || null, now(), r.id);
    const fresh = one(db, 'SELECT * FROM refunds WHERE id=?', r.id);
    emitEvent(db, { merchantId: r.merchant_id, mode: r.mode, type: 'refund.processed', data: { refund: S.refund(fresh) }, orderId: r.order_id, paymentId: r.payment_id });
    return fresh;
  });
}

export function failRefund(db, refund) {
  return tx(db, () => {
    const r = one(db, 'SELECT * FROM refunds WHERE id=?', refund.id);
    if (r.status !== 'pending') throw badRequest('REFUND_NOT_PENDING', `Refund is already ${r.status}`);
    run(db, `UPDATE refunds SET status='failed', processed_at=? WHERE id=?`, now(), r.id);
    return one(db, 'SELECT * FROM refunds WHERE id=?', r.id);
  });
}

// ---------------------------------------------------------------------------
// Payment links

export function createPaymentLink(db, merchant, mode, input) {
  const amount = amountField(input, 'amount');
  const description = optString(input, 'description', 255);
  const referenceId = optString(input, 'reference_id', 64);
  const customer = customerField(input, 'customer');
  const expireBy = optInt(input, 'expire_by', { min: 0 });
  if (expireBy != null && expireBy <= now() + 60) throw validation('expire_by must be at least a minute in the future', 'expire_by');
  // Fail fast if there's no VPA to collect into.
  resolveVpa(db, merchant.id, mode, null);
  const id = ids.paymentLink();
  let code;
  do code = ids.linkCode(); while (one(db, 'SELECT 1 AS x FROM payment_links WHERE code=?', code));
  run(db, `INSERT INTO payment_links (id, merchant_id, mode, code, amount, currency, description, reference_id, customer, status, expire_by, created_at)
           VALUES (?,?,?,?,?,'INR',?,?,?,'active',?,?)`,
    id, merchant.id, mode, code, amount, description, referenceId, JSON.stringify(customer), expireBy, now());
  return one(db, 'SELECT * FROM payment_links WHERE id=?', id);
}

export function cancelPaymentLink(db, link) {
  return tx(db, () => {
    const cur = one(db, 'SELECT * FROM payment_links WHERE id=?', link.id);
    if (cur.status !== 'active') throw badRequest('LINK_NOT_CANCELLABLE', `Payment link is ${cur.status} and cannot be cancelled`);
    run(db, `UPDATE payment_links SET status='cancelled' WHERE id=?`, cur.id);
    // The link's open checkout order must stop being payable too.
    if (cur.order_id) {
      const o = getOrder(db, cur.order_id);
      if (o && isOpen(o)) {
        cancelOrder(db, o, { code: 'LINK_CANCELLED', description: 'The payment link was cancelled by the merchant' });
      }
    }
    return one(db, 'SELECT * FROM payment_links WHERE id=?', cur.id);
  });
}

/** For GET /l/:code — reuse the link's open order or create a fresh one. */
export function orderForLink(db, link) {
  const t = now();
  if (link.status === 'active' && link.expire_by && link.expire_by <= t) {
    run(db, `UPDATE payment_links SET status='expired' WHERE id=?`, link.id);
    link = one(db, 'SELECT * FROM payment_links WHERE id=?', link.id);
  }
  if (link.status !== 'active') return null;
  if (link.order_id) {
    const existing = expireIfDue(db, getOrder(db, link.order_id));
    if (existing && isOpen(existing)) return existing;
  }
  const merchant = getMerchant(db, link.merchant_id);
  let expireIn = merchant.order_expiry_seconds;
  if (link.expire_by) expireIn = Math.max(120, Math.min(expireIn, link.expire_by - t));
  const order = createOrder(db, merchant, link.mode, {
    amount: link.amount,
    customer: JSON.parse(link.customer || '{}'),
    receipt: link.reference_id ? link.reference_id.slice(0, 40) : undefined,
    expire_in: expireIn,
  }, {
    payment_link_id: link.id,
    description: link.description,
    return_url: `${runtime.publicUrl}/l/${link.code}/done`,
  });
  run(db, 'UPDATE payment_links SET order_id=? WHERE id=?', order.id, link.id);
  return order;
}
