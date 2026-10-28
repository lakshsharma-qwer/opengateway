/** HTTP security headers + CSRF origin check for the cookie-authenticated /api routes. */
import { forbidden } from './errors.js';

const SPA_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https: http:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

const isApiPath = (p) => /^\/(api|v1|health)(\/|$)/.test(p);
/** The hosted checkout is the only page merchant sites may embed (checkout.js opens it in an iframe). */
const isEmbeddable = (p) => /^\/pay(\/|$)/.test(p);

export function securityHeaders(config) {
  const hsts = String(config.publicUrl || '').startsWith('https://');
  return (req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    if (hsts) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (isApiPath(req.path)) {
      res.set('Content-Security-Policy', API_CSP);
      res.set('X-Frame-Options', 'DENY');
      res.set('Referrer-Policy', 'no-referrer');
      res.set('Cache-Control', res.get('Cache-Control') || 'no-store');
    } else if (isEmbeddable(req.path)) {
      // The URL carries the payment-session capability: never leak it in Referer.
      res.set('Content-Security-Policy', `${SPA_CSP}; frame-ancestors *`);
      res.set('Referrer-Policy', 'no-referrer');
    } else {
      res.set('Content-Security-Policy', `${SPA_CSP}; frame-ancestors 'none'`);
      res.set('X-Frame-Options', 'DENY');
      res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    next();
  };
}

/** Origins allowed to make state-changing cookie-authenticated requests. */
export function allowedOrigins(config) {
  const set = new Set();
  try { set.add(new URL(config.publicUrl).origin); } catch {}
  if (!config.isProd) {
    for (const o of ['http://localhost:5173', 'http://127.0.0.1:5173']) set.add(o);
  }
  for (const o of config.allowedOrigins || []) {
    try { set.add(new URL(o).origin); } catch {}
  }
  return set;
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth on top of SameSite=Lax: a state-changing request carrying browser
 * provenance headers must come from an allowed origin (or be same-origin per Sec-Fetch-Site).
 * Requests with neither Origin nor Sec-Fetch-Site (curl, server-to-server) carry no ambient
 * browser authority from another site and are allowed.
 */
export function csrfGuard(config) {
  const allowed = allowedOrigins(config);
  return (req, res, next) => {
    if (SAFE.has(req.method)) return next();
    const origin = req.get('Origin');
    const site = req.get('Sec-Fetch-Site');
    if (origin) {
      if (allowed.has(origin)) return next();
      if (site === 'same-origin') return next();
      const self = `${req.protocol}://${req.get('host')}`;
      if (origin === self) return next();
      return next(forbidden('CSRF_REJECTED', 'Cross-site request blocked'));
    }
    if (site && site !== 'same-origin' && site !== 'none') {
      return next(forbidden('CSRF_REJECTED', 'Cross-site request blocked'));
    }
    next();
  };
}
