/** Idempotency-Key handling for POST /v1/* (24h, per merchant + mode). */
import { one, run, now } from '../db.js';
import { sha256 } from './crypto.js';
import { conflict, validation } from './errors.js';

export const IDEMPOTENCY_TTL = 86400;

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

export function idempotencyMiddleware(db) {
  return (req, res, next) => {
    if (req.method !== 'POST') return next();
    const key = req.get('Idempotency-Key');
    if (!key) return next();
    if (key.length > 255) return next(validation('Idempotency-Key must be at most 255 characters', 'Idempotency-Key'));
    const merchantId = req.merchant.id;
    const mode = req.mode;
    const hash = sha256(`${req.method} ${req.baseUrl}${req.path}\n${stable(req.body ?? {})}`);
    const row = one(db, 'SELECT * FROM idempotency_keys WHERE merchant_id=? AND mode=? AND key=?', merchantId, mode, key);
    if (row && row.created_at > now() - IDEMPOTENCY_TTL) {
      if (row.request_hash !== hash) {
        return next(conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used with a different request body'));
      }
      res.set('Idempotent-Replayed', 'true');
      res.status(row.status_code).type('application/json').send(row.response_body);
      return;
    }
    const original = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        run(db, `INSERT OR REPLACE INTO idempotency_keys (merchant_id, mode, key, request_hash, status_code, response_body, created_at)
                 VALUES (?,?,?,?,?,?,?)`, merchantId, mode, key, hash, res.statusCode, JSON.stringify(body), now());
      }
      return original(body);
    };
    next();
  };
}
