import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** Uniformly random base62 string (rejection sampling avoids modulo bias). */
export function base62(len) {
  let out = '';
  while (out.length < len) {
    const buf = randomBytes(len * 2);
    for (const b of buf) {
      if (b < 248) out += ALPHABET[b % 62];
      if (out.length === len) break;
    }
  }
  return out;
}

export const newId = (prefix, len = 14) => prefix + base62(len);

export const ids = {
  merchant: () => newId('mid_'),
  user: () => newId('usr_'),
  vpa: () => newId('vpa_'),
  apiKey: (mode) => newId(mode === 'live' ? 'og_live_' : 'og_test_'),
  order: () => newId('order_'),
  payment: () => newId('pay_'),
  refund: () => newId('rfnd_'),
  paymentLink: () => newId('plink_'),
  observer: () => newId('obs_'),
  observation: () => newId('obsv_'),
  webhook: () => newId('wh_'),
  delivery: () => newId('whd_'),
  event: () => newId('evt_'),
  session: () => newId('ps_', 24),
  apiLog: () => newId('req_'),
  linkCode: () => base62(7),
};
