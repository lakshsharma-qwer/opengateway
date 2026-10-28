export function fmtDate(ts: number | null | undefined, withTime = true): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const date = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (!withTime) return date;
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

export function fmtRelative(ts: number | null | undefined): string {
  if (!ts) return "Never";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 0) return fmtDate(ts);
  if (diff < 45) return "Just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return fmtDate(ts, false);
}

export function fmtCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtDuration(seconds: number): string {
  if (seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}

/** yyyy-mm-dd (local) → unix seconds at local start/end of day */
export function dayStart(s: string): number | undefined {
  if (!s) return undefined;
  return Math.floor(new Date(`${s}T00:00:00`).getTime() / 1000);
}
export function dayEnd(s: string): number | undefined {
  if (!s) return undefined;
  return Math.floor(new Date(`${s}T23:59:59`).getTime() / 1000);
}
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const UPI_APP_LABEL: Record<string, string> = {
  gpay: "Google Pay",
  phonepe: "PhonePe",
  paytm: "Paytm",
  bhim: "BHIM",
  cred: "CRED",
  other: "Other UPI",
};

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
