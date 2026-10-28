const grouper = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const grouperInt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Format integer paise as ₹ with Indian digit grouping: 12345600 → ₹1,23,456.00 */
export function formatINR(paise: number | null | undefined, opts: { compact?: boolean; noDecimals?: boolean } = {}): string {
  if (paise == null || Number.isNaN(paise)) return "—";
  const rupees = paise / 100;
  const neg = rupees < 0;
  const abs = Math.abs(rupees);
  if (opts.compact) {
    if (abs >= 1e7) return `${neg ? "-" : ""}₹${trim(abs / 1e7)}Cr`;
    if (abs >= 1e5) return `${neg ? "-" : ""}₹${trim(abs / 1e5)}L`;
    if (abs >= 1e3) return `${neg ? "-" : ""}₹${trim(abs / 1e3)}K`;
  }
  const s = opts.noDecimals ? grouperInt.format(abs) : grouper.format(abs);
  return `${neg ? "-" : ""}₹${s}`;
}

function trim(n: number) {
  return n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, "");
}

/** Split for display: ["₹1,23,456", ".00"] */
export function splitINR(paise: number): [string, string] {
  const s = formatINR(paise);
  const i = s.lastIndexOf(".");
  return i === -1 ? [s, ""] : [s.slice(0, i), s.slice(i)];
}

/** Parse a rupee string ("1,234.5") into integer paise, or null when invalid. */
export function rupeesToPaise(input: string): number | null {
  const clean = input.replace(/[,\s₹]/g, "");
  if (!clean) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const [r, p = ""] = clean.split(".");
  return Number(r) * 100 + Number((p + "00").slice(0, 2));
}

export function paiseToRupeesString(paise: number | null | undefined): string {
  if (paise == null) return "";
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  return p ? `${r}.${String(p).padStart(2, "0")}` : String(r);
}
