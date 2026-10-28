/** Dashboard cookie sessions + role checks. */
import { one, run, now } from '../db.js';
import { randomToken, sha256 } from './crypto.js';
import { forbidden, unauthorized } from './errors.js';

export const SESSION_COOKIE = 'og_session';
export const SESSION_TTL = 7 * 86400;

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}

export function createSession(db, res, userId, { secure = false } = {}) {
  const token = randomToken(32);
  const t = now();
  run(db, 'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?,?,?,?)', sha256(token), userId, t, t + SESSION_TTL);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, maxAge: SESSION_TTL * 1000, path: '/' });
  return token;
}

export function destroySession(db, req, res, { clearCookie = true } = {}) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) run(db, 'DELETE FROM sessions WHERE id=?', sha256(token));
  if (clearCookie) res.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax' });
}

/** Revoke every session of a user (password change), optionally keeping one (by raw token). */
export function destroyUserSessions(db, userId, { exceptToken = null } = {}) {
  if (exceptToken) run(db, 'DELETE FROM sessions WHERE user_id=? AND id<>?', userId, sha256(exceptToken));
  else run(db, 'DELETE FROM sessions WHERE user_id=?', userId);
}

/** Attach req.user / req.merchant if a valid session cookie is present. */
export function loadSession(db, req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token || token.length > 128) return null;
  const s = one(db, 'SELECT * FROM sessions WHERE id=?', sha256(token));
  if (!s || s.expires_at <= now()) return null;
  const user = one(db, 'SELECT * FROM users WHERE id=?', s.user_id);
  if (!user) return null;
  const merchant = one(db, 'SELECT * FROM merchants WHERE id=?', user.merchant_id);
  if (!merchant) return null;
  return { user, merchant };
}

export function requireSession(db) {
  return (req, res, next) => {
    const s = loadSession(db, req);
    if (!s) return next(unauthorized('UNAUTHENTICATED', 'Please log in to continue'));
    req.user = s.user;
    req.merchant = s.merchant;
    next();
  };
}

/** Allow only the listed roles. */
export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(forbidden('FORBIDDEN', `This action requires one of these roles: ${roles.join(', ')}`));

/** Viewers are read-only across the dashboard API. */
export const viewerReadOnly = (req, res, next) =>
  req.user.role === 'viewer' && req.method !== 'GET' && req.method !== 'HEAD'
    ? next(forbidden('FORBIDDEN', 'Viewers have read-only access'))
    : next();
