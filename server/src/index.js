/** Server entry point. */
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { startJobs } from './jobs.js';
import { waitForDeliveries } from './lib/webhooks.js';

const config = loadConfig();
const db = openDb(config.dbFile);
const app = createApp({ db, config });
const stopJobs = startJobs(db, config.jobIntervalMs);

const server = app.listen(config.port, () => {
  console.log(`OpenGateway server listening on http://localhost:${config.port}`);
  console.log(`  PUBLIC_URL = ${config.publicUrl}`);
  console.log(`  DATA_DIR   = ${config.dataDir}`);
});
// Slow-loris protection: bound header / request time.
server.headersTimeout = 20_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;

let closing = false;
async function shutdown(sig, code = 0) {
  if (closing) return;
  closing = true;
  console.log(`\n${sig} received, shutting down...`);
  // Hard stop if something hangs (a stuck socket, a webhook that ignores its deadline).
  setTimeout(() => { console.error('Forced exit after shutdown timeout'); process.exit(code || 1); }, 10_000).unref();
  stopJobs();
  server.close();
  server.closeIdleConnections?.();
  // In-flight webhook attempts finish (or time out); anything left stays 'pending' in the DB
  // with a lease and is picked up by the job runner after restart.
  await waitForDeliveries(5000);
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}
  try { db.close(); } catch {}
  process.exit(code);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  // State may be inconsistent: log, close the DB cleanly and exit so a supervisor restarts us.
  console.error('[uncaughtException]', err);
  shutdown('uncaughtException', 1);
});
