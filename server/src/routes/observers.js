/** Public observer ingest — POST /v1/observers/ingest (X-Observer-Token or ?token=). */
import express from 'express';
import { one } from '../db.js';
import { sha256 } from '../lib/crypto.js';
import { unauthorized, validation } from '../lib/errors.js';
import { clientIp } from '../lib/http.js';
import { extractIngestPayload, ingestObservation } from '../lib/matching.js';
import { getMerchant } from '../lib/orders.js';
import { apiLogger } from './v1.js';

export function observersRouter(ctx) {
  const { db, limiters } = ctx;
  const r = express.Router();

  // Forwarder apps send JSON, form-encoded or raw text — accept all of them.
  r.use(express.urlencoded({ extended: false, limit: '64kb' }));
  r.use(express.text({ type: ['text/*', 'application/octet-stream'], limit: '64kb' }));

  const auth = (req, res, next) => {
    const token = req.get('X-Observer-Token') || (typeof req.query.token === 'string' ? req.query.token : null);
    if (!token || token.length > 128) return next(unauthorized('INVALID_OBSERVER_TOKEN', 'Missing observer token (X-Observer-Token header or ?token=)'));
    const observer = one(db, 'SELECT * FROM observers WHERE token_hash=?', sha256(token));
    if (!observer || !observer.active) return next(unauthorized('INVALID_OBSERVER_TOKEN', 'Invalid observer token'));
    req.observer = observer;
    req.merchant = getMerchant(db, observer.merchant_id);
    req.mode = observer.mode;
    next();
  };

  r.post('/ingest',
    // Per-IP limit before the token lookup (cheap protection against floods / token guessing).
    limiters.ingest.middleware((req) => `ingest-ip:${clientIp(req)}`),
    auth,
    apiLogger(db, { keyId: () => null }),
    limiters.v1.middleware((req) => `observer:${req.observer.id}`),
    (req, res) => {
      const payload = extractIngestPayload(req);
      if (!payload.text) throw validation('SMS text is required (text, message, msg, body or sms)', 'text');
      const result = ingestObservation(db, req.observer, payload);
      res.json({ ok: true, observation_id: result.observation_id, status: result.status, order_id: result.order_id });
    });

  return r;
}
