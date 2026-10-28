import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');

/**
 * Runtime values that serializers and helpers need without threading config
 * through every call. `createApp` sets these from the active config.
 */
export const runtime = {
  publicUrl: 'http://localhost:5173',
};

export const DEFAULT_RATE_LIMITS = { v1: 120, auth: 20, confirm: 20, ingest: 300, checkout: 300, windowMs: 60_000 };

export function loadConfig(overrides = {}) {
  const env = process.env;
  const port = Number(env.PORT || 4000);
  const isProd = env.NODE_ENV === 'production';
  const dataDir = path.resolve(SERVER_ROOT, env.DATA_DIR || './data');
  const publicUrl = (env.PUBLIC_URL || (isProd ? `http://localhost:${port}` : 'http://localhost:5173')).replace(/\/+$/, '');
  return {
    port,
    isProd,
    dataDir,
    dbFile: path.join(dataDir, 'opengateway.db'),
    webDist: path.resolve(SERVER_ROOT, '../web/dist'),
    publicDir: path.resolve(SERVER_ROOT, 'public'),
    publicUrl,
    masterKey: env.MASTER_KEY || null,
    // Extra origins allowed to make cookie-authenticated state-changing /api calls (comma separated).
    allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    // Express "trust proxy" setting: set TRUST_PROXY when running behind a reverse proxy so req.ip is the client.
    trustProxy: env.TRUST_PROXY || 'loopback',
    rateLimits: { ...DEFAULT_RATE_LIMITS },
    loginLockout: { maxFailures: 10, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
    jobIntervalMs: 15_000,
    webhookTimeoutMs: 8_000,
    ...overrides,
  };
}
