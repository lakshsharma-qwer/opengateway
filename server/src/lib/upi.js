import { paiseToRupees } from './money.js';

/**
 * Build a UPI deep link per the NPCI "upi://pay" linking spec.
 * upi://pay?pa=<vpa>&pn=<payee>&am=<rupees 2dp>&cu=INR&tn=<note>&tr=<ref>
 */
export function buildUpiUri({ vpa, payeeName, amount, note, ref }) {
  const enc = (v) => encodeURIComponent(String(v)).replace(/%40/g, '@');
  const parts = [
    `pa=${enc(vpa)}`,
    `pn=${enc(payeeName || vpa)}`,
    `am=${paiseToRupees(amount)}`,
    'cu=INR',
  ];
  if (note) parts.push(`tn=${enc(String(note).slice(0, 80))}`);
  if (ref) parts.push(`tr=${enc(ref)}`);
  return `upi://pay?${parts.join('&')}`;
}
