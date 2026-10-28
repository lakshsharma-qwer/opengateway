/** Merchant-owned credentials and configuration objects (shared by routes + seed). */
import { one, run, tx, now } from '../db.js';
import { ids, base62 } from './ids.js';
import { encrypt, hashPassword, randomToken, sha256 } from './crypto.js';
import { conflict, validation } from './errors.js';
import { EVENT_TYPES } from './events.js';
import { runtime } from '../config.js';
import { checkWebhookUrl } from './netguard.js';

export const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
export const ROLES = ['owner', 'admin', 'developer', 'viewer'];

export async function createMerchantWithOwner(db, { name, email, password, business_name, phone = null }) {
  if (one(db, 'SELECT id FROM users WHERE email=?', email)) throw conflict('EMAIL_TAKEN', 'An account with this email already exists', 'email');
  const passwordHash = await hashPassword(password);
  return tx(db, () => {
    // Re-check inside the write transaction: two concurrent signups can both pass the check above while hashing.
    if (one(db, 'SELECT id FROM users WHERE email=?', email)) throw conflict('EMAIL_TAKEN', 'An account with this email already exists', 'email');
    const merchantId = ids.merchant();
    const userId = ids.user();
    const t = now();
    run(db, `INSERT INTO merchants (id, business_name, phone, support_email, support_phone, created_at) VALUES (?,?,?,?,?,?)`,
      merchantId, business_name, phone, email, phone, t);
    run(db, `INSERT INTO users (id, merchant_id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,'owner',?)`,
      userId, merchantId, name, email, passwordHash, t);
    const key = createApiKey(db, merchantId, 'test');
    return {
      merchant: one(db, 'SELECT * FROM merchants WHERE id=?', merchantId),
      user: one(db, 'SELECT * FROM users WHERE id=?', userId),
      key,
    };
  });
}

/** Create an API key; deactivates any previously active key of that mode. */
export function createApiKey(db, merchantId, mode) {
  return tx(db, () => {
    const t = now();
    run(db, `UPDATE api_keys SET status='revoked', revoked_at=? WHERE merchant_id=? AND mode=? AND status='active'`, t, merchantId, mode);
    const id = ids.apiKey(mode);
    const secret = base62(32);
    run(db, `INSERT INTO api_keys (id, merchant_id, mode, secret_hash, secret_enc, status, created_at) VALUES (?,?,?,?,?,'active',?)`,
      id, merchantId, mode, sha256(secret), encrypt(secret), t);
    return { row: one(db, 'SELECT * FROM api_keys WHERE id=?', id), secret };
  });
}

export function createVpa(db, merchantId, mode, { vpa, payee_name, label = null, is_default = null }) {
  if (typeof vpa !== 'string' || !VPA_RE.test(vpa.trim())) throw validation('Enter a valid UPI ID like name@okhdfc', 'vpa');
  vpa = vpa.trim();
  if (typeof payee_name !== 'string' || !payee_name.trim() || payee_name.length > 100) throw validation('payee_name is required (max 100 chars)', 'payee_name');
  if (label != null && (typeof label !== 'string' || label.length > 64)) throw validation('label must be a string up to 64 chars', 'label');
  return tx(db, () => {
    if (one(db, 'SELECT id FROM vpas WHERE merchant_id=? AND mode=? AND vpa=?', merchantId, mode, vpa)) {
      throw conflict('VPA_EXISTS', 'This UPI ID is already added in this mode', 'vpa');
    }
    const hasDefault = one(db, 'SELECT id FROM vpas WHERE merchant_id=? AND mode=? AND is_default=1', merchantId, mode);
    const makeDefault = !hasDefault || is_default === true;
    if (makeDefault) run(db, 'UPDATE vpas SET is_default=0 WHERE merchant_id=? AND mode=?', merchantId, mode);
    const id = ids.vpa();
    run(db, `INSERT INTO vpas (id, merchant_id, mode, vpa, payee_name, label, is_default, active, created_at) VALUES (?,?,?,?,?,?,?,1,?)`,
      id, merchantId, mode, vpa, payee_name.trim(), label, makeDefault ? 1 : 0, now());
    return one(db, 'SELECT * FROM vpas WHERE id=?', id);
  });
}

export const observerIngestUrl = (token) => `${runtime.publicUrl}/v1/observers/ingest?token=${encodeURIComponent(token)}`;

export function newObserverToken() {
  return `obt_${randomToken(24)}`;
}

export function createObserver(db, merchantId, mode, name) {
  const token = newObserverToken();
  const id = ids.observer();
  run(db, 'INSERT INTO observers (id, merchant_id, mode, name, token_hash, active, created_at) VALUES (?,?,?,?,?,1,?)',
    id, merchantId, mode, name, sha256(token), now());
  return { row: one(db, 'SELECT * FROM observers WHERE id=?', id), token };
}

export function rotateObserverToken(db, observer) {
  const token = newObserverToken();
  run(db, 'UPDATE observers SET token_hash=? WHERE id=?', sha256(token), observer.id);
  return { row: one(db, 'SELECT * FROM observers WHERE id=?', observer.id), token };
}

export function validateWebhookInput(body, { partial = false, mode = 'live' } = {}) {
  const out = {};
  if (!partial || body.url !== undefined) {
    if (typeof body.url !== 'string' || body.url.length > 2048) throw validation('url must be a valid http(s) URL', 'url');
    const problem = checkWebhookUrl(body.url, mode);
    if (problem) throw validation(problem, 'url');
    out.url = body.url.trim();
  }
  if (body.description !== undefined) {
    if (body.description != null && (typeof body.description !== 'string' || body.description.length > 255)) {
      throw validation('description must be a string up to 255 chars', 'description');
    }
    out.description = body.description || null;
  }
  if (!partial || body.events !== undefined) {
    let events = body.events ?? ['*'];
    if (!Array.isArray(events) || !events.length) throw validation('events must be a non-empty array', 'events');
    for (const e of events) {
      if (e !== '*' && !EVENT_TYPES.includes(e)) throw validation(`Unknown event type: ${e}`, 'events');
    }
    if (events.includes('*')) events = ['*'];
    out.events = [...new Set(events)];
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw validation('active must be a boolean', 'active');
    out.active = body.active;
  }
  return out;
}

export function createWebhookEndpoint(db, merchantId, mode, body) {
  const v = validateWebhookInput(body, { mode });
  const secret = `whsec_${base62(32)}`;
  const id = ids.webhook();
  run(db, `INSERT INTO webhook_endpoints (id, merchant_id, mode, url, description, events, active, secret_enc, created_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
    id, merchantId, mode, v.url, v.description ?? null, JSON.stringify(v.events), v.active === false ? 0 : 1, encrypt(secret), now());
  return { row: one(db, 'SELECT * FROM webhook_endpoints WHERE id=?', id), secret };
}
