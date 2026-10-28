/** Money helpers. Everything is integer paise; currency is always INR. */

export const MIN_AMOUNT = 100;
export const MAX_AMOUNT = 10_000_000;

export function isPaise(v) {
  return Number.isSafeInteger(v);
}

/** 49901 -> "499.01" */
export function paiseToRupees(paise) {
  const neg = paise < 0;
  const p = Math.abs(paise);
  const s = `${Math.floor(p / 100)}.${String(p % 100).padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}

/** "1,23,456.5" -> 12345650; returns null when not a valid positive amount. */
export function rupeesToPaise(str) {
  if (str == null) return null;
  const clean = String(str).replace(/,/g, '').trim();
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
  if (!m) return null;
  const paise = Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null;
}

/** 49900 -> "₹499.00" (Indian digit grouping) */
export function formatINR(paise) {
  const [r, p] = paiseToRupees(paise).split('.');
  const neg = r.startsWith('-');
  const digits = neg ? r.slice(1) : r;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}₹${rest ? rest + ',' : ''}${last3}.${p}`;
}
