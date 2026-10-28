/** Request parsing / validation helpers shared by routers. */
import { validation } from './errors.js';
import { all } from '../db.js';

export const MODES = ['test', 'live'];

export function parseMode(v, field = 'mode') {
  if (v == null || v === '') return 'test';
  if (!MODES.includes(v)) throw validation('mode must be "test" or "live"', field);
  return v;
}

function intParam(q, name, { def, min, max } = {}) {
  const v = q[name];
  if (v == null || v === '') return def;
  if (typeof v !== 'string' && typeof v !== 'number') throw validation(`${name} must be an integer`, name);
  if (!/^-?\d{1,15}$/.test(String(v))) throw validation(`${name} must be an integer`, name);
  const n = Number(v);
  if (min != null && n < min) throw validation(`${name} must be >= ${min}`, name);
  if (max != null && n > max) throw validation(`${name} must be <= ${max}`, name);
  return n;
}

export function listParams(q) {
  return {
    count: intParam(q, 'count', { def: 25, min: 1, max: 100 }),
    skip: intParam(q, 'skip', { def: 0, min: 0, max: 1_000_000 }),
    from: intParam(q, 'from', { def: null, min: 0, max: 99_999_999_999 }),
    to: intParam(q, 'to', { def: null, min: 0, max: 99_999_999_999 }),
  };
}

/**
 * Paginated SELECT. `where` is an array of SQL fragments joined with AND.
 * Returns a collection envelope with items mapped through `map`.
 */
export function paginate(db, { table, where = [], params = [], query = {}, map = (x) => x, orderBy = 'created_at DESC, rowid DESC', timeCol = 'created_at' }) {
  const { count, skip, from, to } = listParams(query);
  const w = [...where];
  const p = [...params];
  if (from != null) { w.push(`${timeCol} >= ?`); p.push(from); }
  if (to != null) { w.push(`${timeCol} <= ?`); p.push(to); }
  const sql = `SELECT * FROM ${table}${w.length ? ' WHERE ' + w.join(' AND ') : ''} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  const rows = all(db, sql, ...p, count + 1, skip);
  const has_more = rows.length > count;
  const items = rows.slice(0, count).map(map);
  return collection(items, has_more);
}

export const collection = (items, has_more = false) => ({ entity: 'collection', count: items.length, has_more, items });

// ---- field validators -------------------------------------------------------

export function optString(body, name, max = 255) {
  const v = body?.[name];
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw validation(`${name} must be a string`, name);
  if (v.length > max) throw validation(`${name} must be at most ${max} characters`, name);
  return v.trim();
}

export function reqString(body, name, max = 255) {
  const v = optString(body, name, max);
  if (!v) throw validation(`${name} is required`, name);
  return v;
}

export function optBool(body, name) {
  const v = body?.[name];
  if (v == null) return null;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  throw validation(`${name} must be a boolean`, name);
}

export function amountField(body, name = 'amount', { min = 100, max = 10_000_000, required = true } = {}) {
  const v = body?.[name];
  if (v == null || v === '') {
    if (required) throw validation(`${name} is required`, name);
    return null;
  }
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw validation(`${name} must be an integer amount in paise`, name);
  if (v < min) throw validation(`${name} must be at least ${min} paise`, name);
  if (v > max) throw validation(`${name} must be at most ${max} paise`, name);
  return v;
}

export function notesField(body, name = 'notes') {
  const v = body?.[name];
  if (v == null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) throw validation(`${name} must be an object`, name);
  const keys = Object.keys(v);
  if (keys.length > 15) throw validation(`${name} can have at most 15 keys`, name);
  const out = {};
  for (const k of keys) {
    if (!k.length || k.length > 64) throw validation(`${name} keys must be 1-64 characters`, name);
    const val = v[k];
    if (val != null && typeof val === 'object') throw validation(`${name} values must be strings or numbers`, name);
    const s = val == null ? '' : String(val);
    if (s.length > 512) throw validation(`${name} values must be at most 512 characters`, name);
    out[k] = s;
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function customerField(body, name = 'customer') {
  const v = body?.[name];
  if (v == null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) throw validation(`${name} must be an object`, name);
  const out = {};
  if (v.name != null && v.name !== '') {
    if (typeof v.name !== 'string' || v.name.length > 100) throw validation('customer.name must be a string up to 100 chars', `${name}.name`);
    out.name = v.name.trim();
  }
  if (v.email != null && v.email !== '') {
    if (typeof v.email !== 'string' || !EMAIL_RE.test(v.email) || v.email.length > 254) throw validation('customer.email is invalid', `${name}.email`);
    out.email = v.email.trim();
  }
  if (v.phone != null && v.phone !== '') {
    if (typeof v.phone !== 'string' && typeof v.phone !== 'number') throw validation('customer.phone is invalid', `${name}.phone`);
    const p = String(v.phone).trim();
    if (!/^\+?[0-9\- ]{6,20}$/.test(p)) throw validation('customer.phone is invalid', `${name}.phone`);
    out.phone = p;
  }
  return out;
}

export function urlField(body, name) {
  const v = optString(body, name, 2048);
  if (!v) return null;
  let u;
  try { u = new URL(v); } catch { throw validation(`${name} must be a valid URL`, name); }
  if (!['http:', 'https:'].includes(u.protocol)) throw validation(`${name} must be an http(s) URL`, name);
  if (u.username || u.password) throw validation(`${name} must not contain credentials`, name);
  return v;
}

export function optInt(body, name, { min, max } = {}) {
  const v = body?.[name];
  if (v == null || v === '') return null;
  const n = typeof v === 'string' && /^-?\d{1,15}$/.test(v) ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isSafeInteger(n)) throw validation(`${name} must be an integer`, name);
  if (min != null && n < min) throw validation(`${name} must be >= ${min}`, name);
  if (max != null && n > max) throw validation(`${name} must be <= ${max}`, name);
  return n;
}

export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
