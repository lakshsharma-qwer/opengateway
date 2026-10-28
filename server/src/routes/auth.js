/** Dashboard auth — /api/auth/* (cookie sessions). */
import express from 'express';
import { one, run, tx, now } from '../db.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { ApiError, unauthorized, validation } from '../lib/errors.js';
import { clientIp, optString, reqString } from '../lib/http.js';
import { createMerchantWithOwner } from '../lib/merchants.js';
import {
  createSession, destroySession, destroyUserSessions, loadSession, requireSession,
} from '../lib/sessions.js';
import * as S from '../lib/serialize.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const mePayload = (user, merchant) => ({
  user: { id: user.id, name: user.name, email: user.email, role: user.role },
  merchant: S.merchantBrief(merchant),
});

// Verified against when the email is unknown, so a login takes the same time either way (no user enumeration).
let dummyHash = null;
const getDummyHash = async () => (dummyHash ??= await hashPassword('opengateway-dummy-password'));

/**
 * Per-account lockout (in memory, keyed by lowercased email so unknown emails behave identically):
 * after `maxFailures` bad passwords within `windowMs`, refuse logins for `lockMs`.
 */
function createLockout({ maxFailures = 10, windowMs = 15 * 60_000, lockMs = 15 * 60_000 } = {}) {
  const map = new Map();
  const sweep = () => {
    const t = Date.now();
    if (map.size < 10_000) return;
    for (const [k, v] of map) if (v.lockedUntil < t && v.first + windowMs < t) map.delete(k);
  };
  return {
    lockedFor(key) {
      const e = map.get(key);
      const t = Date.now();
      return e && e.lockedUntil > t ? Math.ceil((e.lockedUntil - t) / 1000) : 0;
    },
    fail(key) {
      sweep();
      const t = Date.now();
      let e = map.get(key);
      if (!e || e.first + windowMs < t) e = { count: 0, first: t, lockedUntil: 0 };
      e.count++;
      if (e.count >= maxFailures) { e.lockedUntil = t + lockMs; e.count = 0; e.first = t; }
      map.set(key, e);
    },
    success(key) { map.delete(key); },
  };
}

const accountLocked = (retryAfter) => new ApiError(429, 'rate_limit_error', 'ACCOUNT_LOCKED',
  'Too many failed login attempts. Try again later.', null, { 'Retry-After': String(retryAfter) });

export function authRouter(ctx) {
  const { db, config, limiters } = ctx;
  const r = express.Router();
  const lockout = createLockout(config.loginLockout);
  const secure = config.publicUrl.startsWith('https://');
  // Brute-force protection on credential endpoints (GET /me is exempt: the SPA calls it on every load).
  const limit = limiters.auth.middleware((req) => `auth:${clientIp(req)}`);
  const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

  r.post('/signup', limit, async (req, res) => {
    const b = body(req);
    const name = reqString(b, 'name', 100);
    const email = reqString(b, 'email', 254).toLowerCase();
    if (!EMAIL_RE.test(email)) throw validation('Enter a valid email address', 'email');
    const password = typeof b.password === 'string' ? b.password : '';
    if (password.length < 8) throw validation('Password must be at least 8 characters', 'password');
    if (password.length > 200) throw validation('Password is too long', 'password');
    const business_name = reqString(b, 'business_name', 120);
    const phone = optString(b, 'phone', 20);
    if (phone && !/^\+?[0-9\- ]{6,20}$/.test(phone)) throw validation('Enter a valid phone number', 'phone');

    const { merchant, user, key } = await createMerchantWithOwner(db, { name, email, password, business_name, phone });
    createSession(db, res, user.id, { secure });
    res.status(201).json({ ...mePayload(user, merchant), test_key: { key_id: key.row.id, key_secret: key.secret } });
  });

  r.post('/login', limit, async (req, res) => {
    const b = body(req);
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof b.password === 'string' ? b.password.slice(0, 200) : '';
    if (!email || !password) throw unauthorized('INVALID_CREDENTIALS', 'Incorrect email or password');
    const locked = lockout.lockedFor(email);
    if (locked) throw accountLocked(locked);
    const user = one(db, 'SELECT * FROM users WHERE email=?', email);
    const ok = user ? await verifyPassword(password, user.password_hash) : (await verifyPassword(password, await getDummyHash()), false);
    if (!ok) {
      lockout.fail(email);
      throw unauthorized('INVALID_CREDENTIALS', 'Incorrect email or password');
    }
    lockout.success(email);
    run(db, 'UPDATE users SET last_login_at=? WHERE id=?', now(), user.id);
    // Never keep a pre-login session id alive (session fixation). The new cookie overwrites the old one.
    destroySession(db, req, res, { clearCookie: false });
    createSession(db, res, user.id, { secure });
    const merchant = one(db, 'SELECT * FROM merchants WHERE id=?', user.merchant_id);
    res.json(mePayload(user, merchant));
  });

  r.post('/logout', limit, (req, res) => {
    destroySession(db, req, res);
    res.json({ ok: true });
  });

  /** Change own password: revokes every other session of this user and issues a fresh cookie. */
  r.post('/change-password', limit, requireSession(db), async (req, res) => {
    const b = body(req);
    const current = typeof b.current_password === 'string' ? b.current_password : '';
    const next = typeof b.new_password === 'string' ? b.new_password : '';
    if (next.length < 8) throw validation('Password must be at least 8 characters', 'new_password');
    if (next.length > 200) throw validation('Password is too long', 'new_password');
    const lockKey = req.user.email.toLowerCase();
    const locked = lockout.lockedFor(lockKey);
    if (locked) throw accountLocked(locked);
    if (!(await verifyPassword(current, req.user.password_hash))) {
      lockout.fail(lockKey);
      throw validation('Current password is incorrect', 'current_password');
    }
    const hash = await hashPassword(next);
    tx(db, () => {
      run(db, 'UPDATE users SET password_hash=? WHERE id=?', hash, req.user.id);
      destroyUserSessions(db, req.user.id);
    });
    createSession(db, res, req.user.id, { secure });
    res.json({ ok: true });
  });

  r.get('/me', (req, res) => {
    const s = loadSession(db, req);
    if (!s) throw unauthorized('UNAUTHENTICATED', 'Please log in to continue');
    res.json(mePayload(s.user, s.merchant));
  });

  return r;
}
