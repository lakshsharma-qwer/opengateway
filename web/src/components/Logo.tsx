import { cx } from "../lib/format";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#5f259f" />
      <path d="M9 21 16 8l7 13M11.8 16h8.4" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="24.6" r="1.9" fill="#ffc94d" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className={cx("font-display text-[19px] font-bold tracking-tight", light ? "text-white" : "text-ink")}>
        Open<span className={light ? "text-brand-200" : "text-brand-600"}>Gateway</span>
      </span>
    </span>
  );
}

/** Simple text badges for UPI apps — no brand imagery. */
const APP_STYLE: Record<string, { bg: string; fg: string; short: string; name: string }> = {
  gpay: { bg: "#e8f0fe", fg: "#1a56c4", short: "G", name: "Google Pay" },
  phonepe: { bg: "#efe6fa", fg: "#5f259f", short: "Pe", name: "PhonePe" },
  paytm: { bg: "#e4f5fc", fg: "#00669b", short: "Py", name: "Paytm" },
  bhim: { bg: "#fdeee3", fg: "#c4521a", short: "B", name: "BHIM" },
  cred: { bg: "#ececec", fg: "#1c1c1c", short: "C", name: "CRED" },
  other: { bg: "#f0edf4", fg: "#4a3f57", short: "UPI", name: "Other UPI" },
};

export function AppBadge({ app, size = 36 }: { app: string; size?: number }) {
  const s = APP_STYLE[app] ?? APP_STYLE.other;
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-xl font-display font-bold"
      style={{ background: s.bg, color: s.fg, width: size, height: size, fontSize: size * (s.short.length > 2 ? 0.3 : 0.4) }}
    >
      {s.short}
    </span>
  );
}
export const appName = (a: string) => (APP_STYLE[a] ?? APP_STYLE.other).name;
