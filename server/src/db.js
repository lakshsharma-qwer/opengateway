import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Schema migrations. Each entry is applied once, tracked with PRAGMA user_version.
 * Append new migrations; never edit applied ones.
 */
const MIGRATIONS = [
  `
  CREATE TABLE merchants (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    business_type TEXT,
    phone TEXT,
    support_email TEXT,
    support_phone TEXT,
    website TEXT,
    logo_url TEXT,
    brand_color TEXT NOT NULL DEFAULT '#5f259f',
    order_expiry_seconds INTEGER NOT NULL DEFAULT 900,
    unique_amount INTEGER NOT NULL DEFAULT 1,
    onboarding_completed INTEGER NOT NULL DEFAULT 0,
    live_enabled INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner','admin','developer','viewer')),
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
  );
  CREATE INDEX users_merchant ON users(merchant_id);

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE vpas (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('test','live')),
    vpa TEXT NOT NULL,
    payee_name TEXT NOT NULL,
    label TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    UNIQUE (merchant_id, mode, vpa)
  );

  CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('test','live')),
    secret_hash TEXT NOT NULL,
    secret_enc TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    revoked_at INTEGER
  );
  CREATE INDEX api_keys_merchant ON api_keys(merchant_id, mode, status);

  CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('test','live')),
    amount INTEGER NOT NULL,
    amount_payable INTEGER NOT NULL,
    amount_paid INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    receipt TEXT,
    notes TEXT NOT NULL DEFAULT '{}',
    customer TEXT NOT NULL DEFAULT '{}',
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('created','attempted','paid','expired','cancelled')),
    vpa_id TEXT,
    vpa TEXT NOT NULL,
    payee_name TEXT NOT NULL,
    payment_session_id TEXT NOT NULL UNIQUE,
    return_url TEXT,
    payment_link_id TEXT,
    utr TEXT,
    paid_at INTEGER,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX orders_merchant ON orders(merchant_id, mode, created_at);
  CREATE INDEX orders_open ON orders(merchant_id, mode, status, amount_payable);
  CREATE INDEX orders_expiry ON orders(status, expires_at);
  CREATE INDEX orders_receipt ON orders(merchant_id, mode, receipt);

  CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL CHECK (status IN ('created','pending_verification','captured','failed')),
    method TEXT NOT NULL DEFAULT 'upi',
    flow TEXT NOT NULL CHECK (flow IN ('qr','intent','manual')),
    upi_app TEXT,
    utr TEXT,
    payer_vpa TEXT,
    verified_by TEXT,
    observation_id TEXT,
    error_code TEXT,
    error_description TEXT,
    created_at INTEGER NOT NULL,
    captured_at INTEGER,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX payments_order ON payments(order_id, created_at);
  CREATE INDEX payments_merchant ON payments(merchant_id, mode, created_at);
  CREATE INDEX payments_utr ON payments(merchant_id, mode, utr);

  CREATE TABLE refunds (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL CHECK (status IN ('pending','processed','failed')),
    notes TEXT NOT NULL DEFAULT '{}',
    utr TEXT,
    created_at INTEGER NOT NULL,
    processed_at INTEGER
  );
  CREATE INDEX refunds_merchant ON refunds(merchant_id, mode, created_at);
  CREATE INDEX refunds_payment ON refunds(payment_id);

  CREATE TABLE payment_links (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    description TEXT,
    reference_id TEXT,
    customer TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL CHECK (status IN ('active','paid','expired','cancelled')),
    expire_by INTEGER,
    paid_at INTEGER,
    order_id TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX plinks_merchant ON payment_links(merchant_id, mode, created_at);

  CREATE TABLE observers (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    last_seen_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE observations (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    observer_id TEXT REFERENCES observers(id) ON DELETE SET NULL,
    raw_text TEXT NOT NULL,
    sender TEXT,
    text_hash TEXT NOT NULL,
    direction TEXT NOT NULL,
    amount INTEGER,
    utr TEXT,
    payer_vpa TEXT,
    status TEXT NOT NULL CHECK (status IN ('matched','unmatched','ignored','duplicate')),
    order_id TEXT,
    received_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX observations_merchant ON observations(merchant_id, mode, status, created_at);
  CREATE INDEX observations_utr ON observations(merchant_id, mode, utr);
  CREATE INDEX observations_hash ON observations(merchant_id, mode, text_hash, created_at);

  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    type TEXT NOT NULL,
    order_id TEXT,
    payment_id TEXT,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX events_merchant ON events(merchant_id, mode, created_at);
  CREATE INDEX events_order ON events(order_id);

  CREATE TABLE webhook_endpoints (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    events TEXT NOT NULL DEFAULT '["*"]',
    active INTEGER NOT NULL DEFAULT 1,
    secret_enc TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_delivery_at INTEGER,
    failure_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE webhook_deliveries (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','success','failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    response_status INTEGER,
    response_body TEXT,
    duration_ms INTEGER,
    next_attempt_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX deliveries_endpoint ON webhook_deliveries(endpoint_id, created_at);
  CREATE INDEX deliveries_due ON webhook_deliveries(status, next_attempt_at);

  CREATE TABLE idempotency_keys (
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (merchant_id, mode, key)
  );

  CREATE TABLE api_logs (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    key_id TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX api_logs_merchant ON api_logs(merchant_id, mode, created_at);
  `,
  // 2: hardening — closed_at drives the unique-amount slot hold / late-credit grace window; indexes for hot queries.
  `
  ALTER TABLE orders ADD COLUMN closed_at INTEGER;
  UPDATE orders SET closed_at = CASE WHEN status='expired' THEN expires_at ELSE COALESCE(paid_at, updated_at) END
    WHERE status IN ('paid','expired','cancelled');
  CREATE INDEX orders_slot ON orders(merchant_id, mode, amount_payable);
  CREATE INDEX payments_utr_global ON payments(mode, utr);
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE INDEX sessions_expiry ON sessions(expires_at);
  CREATE INDEX api_logs_created ON api_logs(created_at);
  CREATE INDEX idempotency_created ON idempotency_keys(created_at);
  CREATE INDEX webhook_endpoints_merchant ON webhook_endpoints(merchant_id, mode);
  CREATE INDEX observers_merchant ON observers(merchant_id, mode);
  CREATE INDEX observations_order ON observations(order_id);
  CREATE INDEX refunds_order ON refunds(order_id);
  CREATE INDEX plinks_order ON payment_links(order_id);
  `,
];

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  // Wait (instead of failing with SQLITE_BUSY) when another connection/process holds the write lock.
  db.exec('PRAGMA busy_timeout = 5000;');
  if (file !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  }
  migrate(db);
  return db;
}

export function migrate(db) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get();
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

// ---- small query helpers ---------------------------------------------------

const stmtCache = new WeakMap();
function prep(db, sql) {
  let cache = stmtCache.get(db);
  if (!cache) stmtCache.set(db, (cache = new Map()));
  let s = cache.get(sql);
  if (!s) cache.set(sql, (s = db.prepare(sql)));
  return s;
}

export const one = (db, sql, ...params) => prep(db, sql).get(...params) ?? null;
export const all = (db, sql, ...params) => prep(db, sql).all(...params);
export const run = (db, sql, ...params) => prep(db, sql).run(...params);

const depth = new WeakMap();
/** Run fn inside a transaction (nested calls use savepoints). */
export function tx(db, fn) {
  const d = depth.get(db) || 0;
  const sp = `sp_${d}`;
  db.exec(d === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
  depth.set(db, d + 1);
  try {
    const result = fn();
    depth.set(db, d);
    db.exec(d === 0 ? 'COMMIT' : `RELEASE ${sp}`);
    return result;
  } catch (err) {
    depth.set(db, d);
    if (d === 0) db.exec('ROLLBACK');
    else { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); }
    throw err;
  }
}

export const now = () => Math.floor(Date.now() / 1000);
