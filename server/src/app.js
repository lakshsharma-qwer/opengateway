/** Express app factory (used by index.js and by tests). */
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { DEFAULT_RATE_LIMITS, runtime } from './config.js';
import { initMasterKey } from './lib/crypto.js';
import { errorHandler, notFound } from './lib/errors.js';
import { createLimiter } from './lib/ratelimit.js';
import { csrfGuard, securityHeaders } from './lib/security.js';
import { settings as webhookSettings } from './lib/webhooks.js';
import { v1Cors, v1Router } from './routes/v1.js';
import { observersRouter } from './routes/observers.js';
import { checkoutRouter, publicRouter } from './routes/checkout.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { linksRouter } from './routes/links.js';

export function createApp({ db, config }) {
  runtime.publicUrl = config.publicUrl;
  webhookSettings.timeoutMs = config.webhookTimeoutMs ?? 8000;
  initMasterKey(config);

  const rl = { ...DEFAULT_RATE_LIMITS, ...(config.rateLimits || {}) };
  const limiters = {
    v1: createLimiter({ limit: rl.v1, windowMs: rl.windowMs }),
    auth: createLimiter({ limit: rl.auth, windowMs: rl.windowMs }),
    confirm: createLimiter({ limit: rl.confirm, windowMs: rl.windowMs }),
    ingest: createLimiter({ limit: rl.ingest, windowMs: rl.windowMs }),
    checkout: createLimiter({ limit: rl.checkout, windowMs: rl.windowMs }),
  };
  const ctx = { db, config, limiters };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ?? 'loopback');
  app.locals.ctx = ctx;
  app.use(securityHeaders(config));

  app.get('/health', (req, res) => {
    let dbOk = true;
    try { db.prepare('SELECT 1').get(); } catch { dbOk = false; }
    res.status(dbOk ? 200 : 503).json({ ok: dbOk, service: 'opengateway', time: Math.floor(Date.now() / 1000) });
  });

  // Browser SDK. The gateway's PUBLIC_URL is baked in so the iframe points at the hosted checkout.
  const sdkPath = path.join(config.publicDir, 'checkout.js');
  let sdkCache = null;
  app.get('/checkout.js', (req, res) => {
    if (!sdkCache || !config.isProd) {
      sdkCache = fs.readFileSync(sdkPath, 'utf8').replace(/__OG_PUBLIC_URL__/g, config.publicUrl);
    }
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', config.isProd ? 'public, max-age=300' : 'no-cache');
    res.type('application/javascript').send(sdkCache);
  });

  const json = express.json({ limit: '100kb' });

  // /v1 — CORS enabled (merchant servers). Observer ingest has its own token auth.
  app.use('/v1', v1Cors);
  app.use('/v1/observers', express.json({ limit: '64kb', type: ['application/json', 'application/*+json'] }), observersRouter(ctx));
  app.use('/v1', json, v1Router(ctx));

  // /api — no CORS (cookie auth, same-origin via the Vite proxy / prod static).
  // /api/checkout and /api/public carry no ambient (cookie) authority, so no CSRF check there.
  app.use('/api/checkout', json, checkoutRouter(ctx));
  app.use('/api/public', publicRouter(ctx));
  const csrf = csrfGuard(config);
  app.use('/api/auth', csrf, json, authRouter(ctx));
  app.use('/api', csrf, json, dashboardRouter(ctx));

  app.use('/l', linksRouter(ctx));

  // Production: serve the built SPA with fallback for non-API GETs.
  if (fs.existsSync(path.join(config.webDist, 'index.html'))) {
    app.use(express.static(config.webDist, { index: false, maxAge: config.isProd ? '1h' : 0 }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (/^\/(api|v1)(\/|$)/.test(req.path)) return next();
      res.sendFile(path.join(config.webDist, 'index.html'));
    });
  }

  app.use((req, res, next) => next(notFound(`No route ${req.method} ${req.path}`)));
  app.use(errorHandler);
  return app;
}
