import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
let MASTER = null;

/** Load MASTER_KEY (32-byte hex) from config/env, or create data/master.key. */
export function initMasterKey({ masterKey, dataDir }) {
  let hex = masterKey;
  if (!hex) {
    const file = path.join(dataDir, 'master.key');
    if (fs.existsSync(file)) hex = fs.readFileSync(file, 'utf8').trim();
    else {
      fs.mkdirSync(dataDir, { recursive: true });
      hex = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(file, hex + '\n', { mode: 0o600 });
    }
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('MASTER_KEY must be 32 bytes of hex (64 chars)');
  MASTER = Buffer.from(hex, 'hex');
}

export function setMasterKeyHex(hex) {
  MASTER = Buffer.from(hex, 'hex');
}

function key() {
  if (!MASTER) throw new Error('Master key not initialised');
  return MASTER;
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function decrypt(blob) {
  const [v, iv, tag, ct] = String(blob).split('.');
  if (v !== 'v1') throw new Error('Unknown ciphertext version');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scrypt(String(password).normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, {
    N: 16384, r: 8, p: 1,
  });
  return crypto.timingSafeEqual(actual, expected);
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const hmacHex = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
