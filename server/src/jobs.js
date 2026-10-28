/** Background jobs: order expiry sweeper + webhook retries + housekeeping (every 15 s). */
import { run, now } from './db.js';
import { expireDue } from './lib/orders.js';
import { processDueDeliveries } from './lib/webhooks.js';
import { IDEMPOTENCY_TTL } from './lib/idempotency.js';

/** One pass. Idempotent: every step re-checks state, so overlapping or repeated runs are harmless. */
export async function runJobsOnce(db) {
  const expired = expireDue(db);
  const delivered = await processDueDeliveries(db);
  const t = now();
  run(db, 'DELETE FROM idempotency_keys WHERE created_at < ?', t - IDEMPOTENCY_TTL);
  run(db, 'DELETE FROM sessions WHERE expires_at < ?', t);
  run(db, 'DELETE FROM api_logs WHERE created_at < ?', t - 30 * 86400);
  return { expired, delivered };
}

export function startJobs(db, intervalMs = 15_000) {
  let running = false;
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await runJobsOnce(db);
    } catch (err) {
      console.error('[jobs]', err);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  const first = setTimeout(tick, 1000);
  first.unref?.();
  return () => { stopped = true; clearInterval(timer); clearTimeout(first); };
}
