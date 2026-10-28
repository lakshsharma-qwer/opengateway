/** Fixed-window in-memory rate limiter with RateLimit-* headers. */
import { rateLimited } from './errors.js';

export function createLimiter({ limit, windowMs = 60_000 }) {
  const buckets = new Map();
  let lastSweep = Date.now();

  function hit(key) {
    const t = Date.now();
    if (t - lastSweep > windowMs) {
      for (const [k, b] of buckets) if (b.reset <= t) buckets.delete(k);
      lastSweep = t;
    }
    let b = buckets.get(key);
    if (!b || b.reset <= t) {
      b = { count: 0, reset: t + windowMs };
      buckets.set(key, b);
    }
    b.count++;
    return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count), resetIn: Math.ceil((b.reset - t) / 1000) };
  }

  /** Express middleware factory; keyFn(req) -> string. */
  function middleware(keyFn) {
    return (req, res, next) => {
      const r = hit(keyFn(req));
      res.set('RateLimit-Limit', String(limit));
      res.set('RateLimit-Remaining', String(r.remaining));
      res.set('RateLimit-Reset', String(r.resetIn));
      if (!r.allowed) return next(rateLimited(r.resetIn));
      next();
    };
  }

  return { hit, middleware, reset: () => buckets.clear() };
}
