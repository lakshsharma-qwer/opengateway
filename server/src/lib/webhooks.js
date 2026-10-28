/** Signed webhook delivery with retries. */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { one, all, run, now } from '../db.js';
import { decrypt, hmacHex, safeEqual } from './crypto.js';
import { ids } from './ids.js';
import { addressAllowed, guardedLookup } from './netguard.js';
import * as S from './serialize.js';

/** Delay before the next attempt, indexed by attempts already made (1..6). */
export const BACKOFF_SECONDS = [60, 300, 1800, 7200, 21600, 43200];
/** timeoutMs: hard deadline for the whole request (connect + headers + body). maxResponseBytes: we stop reading after this. */
export const settings = { timeoutMs: 8000, maxResponseBytes: 64 * 1024 };

/**
 * POST a webhook body with SSRF protection (resolved addresses are checked per mode),
 * no redirects, a hard deadline, and a cap on how much of the response we read.
 * Resolves { status, text } or { status: null, text: <error> }; never rejects.
 */
export function postWebhook(url, { headers, body, mode, timeoutMs = settings.timeoutMs, maxBytes = settings.maxResponseBytes }) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve({ status: null, text: 'Request failed: invalid URL' }); }
    if (!['http:', 'https:'].includes(u.protocol)) return resolve({ status: null, text: 'Request failed: unsupported protocol' });
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && !addressAllowed(host, mode)) {
      return resolve({ status: null, text: 'Request blocked: destination is a private or reserved address' });
    }
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } };
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method: 'POST',
      agent: false,
      lookup: guardedLookup(mode),
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body), Connection: 'close' },
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        if (size >= maxBytes) return;
        chunks.push(c);
        size += c.length;
        if (size >= maxBytes) {
          // Enough: we only store the first 2 KB anyway. Don't let a huge body tie us up.
          finish({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') });
          res.destroy();
        }
      });
      res.on('end', () => finish({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', () => finish({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('close', () => finish({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    const timer = setTimeout(() => {
      finish({ status: null, text: `Timed out after ${timeoutMs} ms` });
      req.destroy();
    }, timeoutMs);
    req.on('error', (err) => {
      const blocked = err?.code === 'EBLOCKED';
      finish({ status: null, text: blocked ? `Request blocked: ${err.message}` : `Request failed: ${err?.code || err?.message || err}` });
    });
    req.end(body);
  });
}

const inflight = new Set(); // delivery ids currently being attempted
const running = new Set(); // promises
let queued = 0;

export function signWebhook(secret, rawBody, t = now()) {
  return `t=${t},v1=${hmacHex(secret, `${t}.${rawBody}`)}`;
}

/** Verify an X-OpenGateway-Signature header. Tolerance in seconds (0 = skip check). */
export function verifyWebhookSignature(secret, header, rawBody, tolerance = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((kv) => kv.trim().split('=')));
  const t = Number(parts.t);
  if (!t || !parts.v1) return false;
  if (tolerance && Math.abs(now() - t) > tolerance) return false;
  return safeEqual(hmacHex(secret, `${t}.${rawBody}`), parts.v1);
}

export function endpointWantsEvent(ep, type) {
  let list;
  try { list = JSON.parse(ep.events); } catch { list = ['*']; }
  return list.includes('*') || list.includes(type);
}

export function createDelivery(db, { merchantId, mode, endpointId, eventId, eventType }) {
  const id = ids.delivery();
  const t = now();
  run(db, `INSERT INTO webhook_deliveries (id, merchant_id, mode, endpoint_id, event_id, event_type, status, attempts, next_attempt_at, created_at, updated_at)
           VALUES (?,?,?,?,?,?,'pending',0,?,?,?)`, id, merchantId, mode, endpointId, eventId, eventType, t, t, t);
  return id;
}

/** Schedule an attempt right after the current synchronous work (i.e. after commit). */
export function queueDelivery(db, deliveryId) {
  queued++;
  setImmediate(() => {
    queued--;
    track(attemptDelivery(db, deliveryId));
  });
}

function track(promise) {
  const p = promise.catch((err) => console.error('[webhooks]', err)).finally(() => running.delete(p));
  running.add(p);
  return p;
}

/** Resolves when no deliveries are queued or in flight (used by tests / shutdown). */
export async function waitForDeliveries(timeoutMs = 15000) {
  const until = Date.now() + timeoutMs;
  while ((queued > 0 || running.size > 0) && Date.now() < until) {
    await Promise.allSettled([...running]);
    await new Promise((r) => setImmediate(r));
  }
}

/** Lease length for a claimed attempt: if the process dies mid-attempt the delivery becomes due again after this. */
const leaseSeconds = () => Math.ceil(settings.timeoutMs / 1000) + 30;

export async function attemptDelivery(db, deliveryId, { retry = true } = {}) {
  if (inflight.has(deliveryId)) return null;
  const d = one(db, 'SELECT * FROM webhook_deliveries WHERE id = ?', deliveryId);
  if (!d || d.status !== 'pending') return d;
  const t0 = now();
  // Claim the delivery (lease). Prevents double sends from the job + queue, or from a second process.
  const claimed = run(db, `UPDATE webhook_deliveries SET next_attempt_at=?, updated_at=? WHERE id=? AND status='pending'
                           AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`, t0 + leaseSeconds(), t0, d.id, t0).changes;
  if (!claimed) return d;
  inflight.add(deliveryId);
  try {
    const ep = one(db, 'SELECT * FROM webhook_endpoints WHERE id = ?', d.endpoint_id);
    const ev = one(db, 'SELECT * FROM events WHERE id = ?', d.event_id);
    if (!ep || !ev) {
      run(db, `UPDATE webhook_deliveries SET status='failed', next_attempt_at=NULL, response_body=?, updated_at=? WHERE id=?`,
        'Endpoint or event no longer exists', now(), d.id);
      return one(db, 'SELECT * FROM webhook_deliveries WHERE id = ?', d.id);
    }
    const body = JSON.stringify(S.event(ev));
    const secret = decrypt(ep.secret_enc);
    const t = now();
    const started = performance.now();
    const { status, text } = await postWebhook(ep.url, {
      mode: ep.mode,
      body,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OpenGateway-Webhooks/1.0',
        'X-OpenGateway-Event': ev.type,
        'X-OpenGateway-Event-Id': ev.id,
        'X-OpenGateway-Delivery-Id': d.id,
        'X-OpenGateway-Signature': signWebhook(secret, body, t),
      },
    });
    const duration = Math.round(performance.now() - started);
    const attempts = d.attempts + 1;
    const ok = status != null && status >= 200 && status < 300;
    const done = now();
    let newStatus = 'success';
    let next = null;
    if (!ok) {
      if (retry && attempts <= BACKOFF_SECONDS.length) {
        newStatus = 'pending';
        next = done + BACKOFF_SECONDS[attempts - 1];
      } else newStatus = 'failed';
    }
    let stored = String(text ?? '').slice(0, 2048);
    if (status >= 300 && status < 400) stored = `Redirect not followed (${status}). ${stored}`.slice(0, 2048);
    run(db, `UPDATE webhook_deliveries SET status=?, attempts=?, response_status=?, response_body=?, duration_ms=?, next_attempt_at=?, updated_at=? WHERE id=?`,
      newStatus, attempts, status, stored, duration, next, done, d.id);
    if (ok) run(db, 'UPDATE webhook_endpoints SET last_delivery_at=?, failure_count=0 WHERE id=?', done, ep.id);
    else run(db, 'UPDATE webhook_endpoints SET last_delivery_at=?, failure_count=failure_count+1 WHERE id=?', done, ep.id);
    return one(db, 'SELECT * FROM webhook_deliveries WHERE id = ?', d.id);
  } catch (err) {
    // Release the lease so the job retries soon instead of waiting for it to lapse.
    try { run(db, `UPDATE webhook_deliveries SET next_attempt_at=? WHERE id=? AND status='pending'`, now() + 60, d.id); } catch {}
    throw err;
  } finally {
    inflight.delete(deliveryId);
  }
}

/** Called by the job runner: attempt every pending delivery that is due. */
export async function processDueDeliveries(db, limit = 50) {
  const due = all(db, `SELECT id FROM webhook_deliveries WHERE status='pending' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?
                       ORDER BY next_attempt_at LIMIT ?`, now(), limit);
  await Promise.all(due.map((d) => track(attemptDelivery(db, d.id))));
  return due.length;
}

/** Send a `ping` event to one endpoint and wait for the result. */
export async function sendTestPing(db, ep) {
  const id = ids.event();
  const t = now();
  const data = { message: 'Test webhook from OpenGateway', webhook_id: ep.id };
  run(db, 'INSERT INTO events (id, merchant_id, mode, type, data, created_at) VALUES (?,?,?,?,?,?)',
    id, ep.merchant_id, ep.mode, 'ping', JSON.stringify(data), t);
  const dId = createDelivery(db, { merchantId: ep.merchant_id, mode: ep.mode, endpointId: ep.id, eventId: id, eventType: 'ping' });
  return attemptDelivery(db, dId, { retry: false });
}

/** Re-send an existing delivery's event to its endpoint as a fresh delivery. */
export async function resendDelivery(db, d) {
  const dId = createDelivery(db, { merchantId: d.merchant_id, mode: d.mode, endpointId: d.endpoint_id, eventId: d.event_id, eventType: d.event_type });
  return track(attemptDelivery(db, dId));
}
