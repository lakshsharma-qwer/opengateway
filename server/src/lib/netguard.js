/**
 * SSRF guard for outbound webhook requests.
 *
 * Live mode: only public unicast addresses are allowed.
 * Test mode: public addresses plus loopback (so merchants can test against a
 * local receiver); every other private / link-local / reserved range is blocked.
 *
 * The check runs twice: on the URL when the endpoint is saved (IP literals and
 * "localhost"), and on every resolved address at connect time (via the `lookup`
 * hook), so DNS rebinding cannot sneak a private address in later.
 */
import dns from 'node:dns';
import net from 'node:net';

const v4 = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) v4.addSubnet(addr, prefix, 'ipv4');

const v6 = new net.BlockList();
for (const [addr, prefix] of [
  ['::', 128], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8], ['2001:db8::', 32], ['100::', 64], ['2001::', 32],
]) v6.addSubnet(addr, prefix, 'ipv6');

const LOOPBACK_V4 = new net.BlockList();
LOOPBACK_V4.addSubnet('127.0.0.0', 8, 'ipv4');

/** Extract an embedded IPv4 from ::ffff:a.b.c.d / ::a.b.c.d / 64:ff9b::a.b.c.d, else null. */
function embeddedV4(ip) {
  const m = /^(?:::ffff:(?:0:)?|::|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (m) return m[1];
  const h = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  if (h) {
    const a = parseInt(h[1], 16);
    const b = parseInt(h[2], 16);
    return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  }
  return null;
}

export function isLoopback(ip) {
  const s = String(ip).replace(/^\[|\]$/g, '');
  if (s === '::1') return true;
  const e = net.isIPv6(s) ? embeddedV4(s) : s;
  return !!e && net.isIPv4(e) && LOOPBACK_V4.check(e, 'ipv4');
}

/** True for any non-public address (loopback included). */
export function isPrivateAddress(ip) {
  const s = String(ip).replace(/^\[|\]$/g, '');
  if (isLoopback(s)) return true;
  if (net.isIPv4(s)) return v4.check(s, 'ipv4');
  if (net.isIPv6(s)) {
    const e = embeddedV4(s);
    if (e) return isPrivateAddress(e);
    return v6.check(s, 'ipv6');
  }
  return true; // not an IP at all: refuse
}

export const guardSettings = {
  /** Allow loopback targets for test-mode webhooks (set OG_STRICT_WEBHOOKS=1 to disable). */
  allowLoopbackInTest: process.env.OG_STRICT_WEBHOOKS !== '1',
};

/** Is this resolved address an allowed webhook target for the given mode? */
export function addressAllowed(ip, mode) {
  if (!isPrivateAddress(ip)) return true;
  return mode === 'test' && guardSettings.allowLoopbackInTest && isLoopback(ip);
}

const isLocalhostName = (h) => h === 'localhost' || h.endsWith('.localhost');

/**
 * Static URL check (no DNS). Returns an error message or null.
 * Rejects non-http(s), embedded credentials, and private IP literals / localhost names.
 */
export function checkWebhookUrl(raw, mode) {
  let u;
  try { u = new URL(String(raw)); } catch { return 'url must be a valid http(s) URL'; }
  if (!['http:', 'https:'].includes(u.protocol)) return 'url must be a valid http(s) URL';
  if (u.username || u.password) return 'url must not contain credentials';
  const host = u.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
  if (!host) return 'url must have a host';
  if (isLocalhostName(host)) {
    return mode === 'test' && guardSettings.allowLoopbackInTest ? null : 'url must not point to localhost or a private network';
  }
  if (net.isIP(host) && !addressAllowed(host, mode)) return 'url must not point to localhost or a private network';
  return null;
}

/** dns.lookup replacement that refuses blocked addresses (used as the http(s) `lookup` option). */
export function guardedLookup(mode) {
  return (hostname, options, callback) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family || 4 }];
      const bad = list.find((a) => !addressAllowed(a.address, mode));
      if (bad || !list.length) {
        const e = new Error(`Blocked: ${hostname} resolves to a private or reserved address`);
        e.code = 'EBLOCKED';
        return callback(e);
      }
      if (options.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  };
}
