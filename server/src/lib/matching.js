/** Observer ingest: store observation, dedup, match against open orders, capture. */
import { one, all, run, tx, now } from '../db.js';
import { ids } from './ids.js';
import { sha256 } from './crypto.js';
import { badRequest, notFound } from './errors.js';
import { parseSms } from './sms-parser.js';
import { HOLDS_SLOT_SQL, LATE_CREDIT_GRACE_SECONDS, OPEN_STATUSES, captureOrder } from './orders.js';

export const DEDUP_WINDOW_SECONDS = 600;

/** Pull the SMS text / sender / received_at out of a lenient forwarder payload. */
export function extractIngestPayload(req) {
  let body = req.body;
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.startsWith('{')) {
      try { body = JSON.parse(trimmed); } catch { body = { text: body }; }
    } else body = { text: body };
  }
  if (!body || typeof body !== 'object') body = {};
  const q = req.query || {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = body[k] ?? q[k];
      if (v != null && String(v).trim() !== '') return String(v);
    }
    return null;
  };
  return {
    text: pick('text', 'message', 'msg', 'body', 'sms', 'content'),
    sender: pick('from', 'sender', 'address'),
    received_at: parseReceivedAt(pick('received_at', 'timestamp', 'sentStamp', 'receivedStamp')),
  };
}

function parseReceivedAt(v) {
  if (v == null) return null;
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return n > 1e12 ? Math.floor(n / 1000) : n;
  }
  const d = Date.parse(v);
  return Number.isNaN(d) ? null : Math.floor(d / 1000);
}

/** Max SMS characters we parse / store. Real bank SMS are < 1 KB. */
export const MAX_SMS_CHARS = 4000;
/** How far back "I have paid" may look for an unmatched credit. */
export const CONFIRM_LOOKBACK_SECONDS = 1800;

const amountFits = (o, amount) => amount != null && amount >= o.amount && amount <= o.amount_payable;

/**
 * Decide which order an observed credit belongs to. Returns { order, late } or null (=> leave unmatched).
 *
 * Errs toward "no match": a false match marks an order paid without money.
 *  1. UTR: a payment on this merchant/mode that the customer tied to this UTR, on an order that is open or expired
 *     within the grace window, AND the credited amount fits that order (amount <= credit <= amount_payable).
 *     A UTR claim alone never captures anything; it only disambiguates a real observed credit.
 *  2. Amount: the orders whose amount_payable equals the credit and that still hold their slot (open, or closed
 *     within the grace window). Exactly one candidate is required. If that one is open -> capture; expired within
 *     the grace window -> capture as a late credit; paid / cancelled -> null (never re-attributed elsewhere).
 */
export function findMatchingOrder(db, merchantId, mode, parsed, t = now()) {
  if (parsed.direction !== 'credit' || parsed.amount == null) return null;
  const graceStart = t - LATE_CREDIT_GRACE_SECONDS;
  const verdict = (o) => {
    if (OPEN_STATUSES.includes(o.status) && o.expires_at > t) return { order: o, late: false };
    if ((o.status === 'expired' || OPEN_STATUSES.includes(o.status)) && o.expires_at > graceStart) return { order: o, late: true };
    return null;
  };
  if (parsed.utr) {
    const byUtr = all(db, `SELECT DISTINCT o.* FROM payments p JOIN orders o ON o.id = p.order_id
                           WHERE p.merchant_id=? AND p.mode=? AND p.utr=?
                             AND (p.status IN ('created','pending_verification') OR (p.status='failed' AND p.error_code='ORDER_EXPIRED'))
                             AND o.status IN ('created','attempted','expired') AND o.expires_at > ?`,
      merchantId, mode, parsed.utr, graceStart).filter((o) => amountFits(o, parsed.amount));
    if (byUtr.length === 1) {
      const v = verdict(byUtr[0]);
      if (v) return v;
    }
  }
  const byAmount = all(db, `SELECT * FROM orders WHERE merchant_id=?2 AND mode=?3 AND amount_payable=?4 AND ${HOLDS_SLOT_SQL}`,
    graceStart, merchantId, mode, parsed.amount);
  if (byAmount.length !== 1) return null;
  return verdict(byAmount[0]);
}

/**
 * Mark an observation as matched to an order and capture the order (one transaction; re-checks the
 * observation's state inside it so it can never be attached twice).
 * verifiedBy 'observer': automatic match (credit + amount required, expired orders only within grace).
 * verifiedBy 'merchant': manual attach from the dashboard (merchant is authoritative).
 */
export function attachObservation(db, obsOrId, orderId, verifiedBy = 'observer', { late = false } = {}) {
  return tx(db, () => {
    const obs = one(db, 'SELECT * FROM observations WHERE id=?', typeof obsOrId === 'string' ? obsOrId : obsOrId.id);
    if (!obs) throw notFound('Observation not found');
    const allowed = verifiedBy === 'merchant' ? ['unmatched', 'ignored'] : ['unmatched'];
    if (!allowed.includes(obs.status)) throw badRequest('OBSERVATION_NOT_ATTACHABLE', `Observation is ${obs.status}`);
    if (verifiedBy === 'observer' && (obs.direction !== 'credit' || obs.amount == null)) {
      throw badRequest('OBSERVATION_NOT_ATTACHABLE', 'Observation is not a credit');
    }
    const res = captureOrder(db, orderId, {
      verified_by: verifiedBy,
      utr: obs.utr,
      payer_vpa: obs.payer_vpa,
      observation_id: obs.id,
      flow: 'qr',
      allowExpired: verifiedBy === 'merchant' || late,
      allowCancelled: verifiedBy === 'merchant',
      amount: verifiedBy === 'observer' ? obs.amount : undefined,
    });
    run(db, `UPDATE observations SET status='matched', order_id=? WHERE id=?`, orderId, obs.id);
    return res;
  });
}

/**
 * Customer clicked "I have paid": look for an unmatched credit observed *after the order was created* that
 * the matcher would attribute to exactly this order. Never captures on the customer's word alone.
 */
export function matchOrderToRecentObservation(db, order, payment) {
  const t = now();
  // Strictly after creation: a credit seen before the order existed cannot be its payment.
  const since = Math.max(order.created_at, t - CONFIRM_LOOKBACK_SECONDS);
  const candidates = [];
  if (payment?.utr) {
    candidates.push(...all(db, `SELECT * FROM observations WHERE merchant_id=? AND mode=? AND status='unmatched' AND direction='credit'
                                AND utr=? AND created_at > ? ORDER BY created_at DESC LIMIT 5`,
      order.merchant_id, order.mode, payment.utr, order.created_at));
  }
  candidates.push(...all(db, `SELECT * FROM observations WHERE merchant_id=? AND mode=? AND status='unmatched' AND direction='credit'
                              AND amount=? AND created_at > ? ORDER BY created_at DESC LIMIT 5`,
    order.merchant_id, order.mode, order.amount_payable, since));
  for (const obs of candidates) {
    const m = findMatchingOrder(db, order.merchant_id, order.mode, { direction: obs.direction, amount: obs.amount, utr: obs.utr }, t);
    if (m && m.order.id === order.id && !m.late) {
      try {
        return attachObservation(db, obs.id, order.id, 'observer');
      } catch (err) {
        if (!err?.code) throw err;
      }
    }
  }
  return null;
}

/**
 * Ingest one forwarded SMS/notification for an observer. The whole thing (dedup check, insert, match,
 * capture) runs in one BEGIN IMMEDIATE transaction, so two copies of the same SMS arriving at once
 * (or from two processes) can't both be counted.
 * Returns { ok, observation_id, status, order_id }.
 */
export function ingestObservation(db, observer, { text, sender = null, received_at = null }) {
  const clipped = String(text).slice(0, MAX_SMS_CHARS);
  const parsed = parseSms(clipped);
  const merchantId = observer.merchant_id;
  const mode = observer.mode;
  const textHash = sha256(`${clipped.replace(/\s+/g, ' ').trim()}\n${sender || ''}`);
  const id = ids.observation();

  return tx(db, () => {
    const t = now();
    let status;
    if (parsed.direction !== 'credit' || parsed.amount == null) {
      status = 'ignored';
    } else if (
      (parsed.utr && one(db, `SELECT id FROM observations WHERE merchant_id=? AND mode=? AND utr=? AND status<>'duplicate' LIMIT 1`, merchantId, mode, parsed.utr)) ||
      one(db, `SELECT id FROM observations WHERE merchant_id=? AND mode=? AND text_hash=? AND created_at>=? AND status<>'duplicate' LIMIT 1`, merchantId, mode, textHash, t - DEDUP_WINDOW_SECONDS)
    ) {
      status = 'duplicate';
    } else {
      status = 'unmatched';
    }

    run(db, `INSERT INTO observations (id, merchant_id, mode, observer_id, raw_text, sender, text_hash, direction, amount, utr, payer_vpa, status, order_id, received_at, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?)`,
      id, merchantId, mode, observer.id, clipped, sender ? String(sender).slice(0, 64) : null, textHash, parsed.direction, parsed.amount, parsed.utr, parsed.payer_vpa,
      status, received_at, t);
    run(db, 'UPDATE observers SET last_seen_at=? WHERE id=?', t, observer.id);

    let orderId = null;
    if (status === 'unmatched') {
      const m = findMatchingOrder(db, merchantId, mode, parsed, t);
      if (m) {
        try {
          attachObservation(db, id, m.order.id, 'observer', { late: m.late });
          status = 'matched';
          orderId = m.order.id;
        } catch (err) {
          // e.g. UTR already used on another order — leave it unmatched for manual review.
          if (!err?.code) throw err;
        }
      }
    }
    return { ok: true, observation_id: id, status, order_id: orderId, parsed };
  });
}
