import type { UpiApp } from "./types";

/** Rewrites a upi://pay?... URI into an app-specific intent URI. */
export function intentFor(app: UpiApp, upiUri: string): string {
  const q = upiUri.includes("?") ? upiUri.slice(upiUri.indexOf("?") + 1) : "";
  switch (app) {
    case "gpay":
      return `tez://upi/pay?${q}`;
    case "phonepe":
      return `phonepe://pay?${q}`;
    case "paytm":
      return `paytmmp://pay?${q}`;
    case "cred":
      return `credpay://upi/pay?${q}`;
    case "bhim":
    case "other":
    default:
      return `upi://pay?${q}`;
  }
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const narrow = typeof window !== "undefined" && window.innerWidth < 768;
  return uaMobile || narrow;
}
