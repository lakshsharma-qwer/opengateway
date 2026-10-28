import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Ban, Check, ChevronRight, Clock3, FlaskConical, Loader2, QrCode, ShieldCheck, Smartphone, X, XCircle } from "lucide-react";
import { api, ApiError, errorMessage } from "../../lib/api";
import type { CheckoutSession, CheckoutStatus, UpiApp } from "../../lib/types";
import { formatINR, splitINR } from "../../lib/money";
import { cx, fmtCountdown } from "../../lib/format";
import { useCountdown } from "../../lib/hooks";
import { intentFor, isMobileDevice } from "../../lib/upi";
import { QR } from "../../components/QR";
import { AppBadge, LogoMark } from "../../components/Logo";
import { CopyButton } from "../../components/ui";

type View = "loading" | "error" | "pay" | "confirm" | "verifying" | "paid" | "failed" | "expired" | "cancelled";
const TERMINAL: View[] = ["paid", "expired", "cancelled"];

const APPS: { id: UpiApp; label: string }[] = [
  { id: "gpay", label: "Google Pay" },
  { id: "phonepe", label: "PhonePe" },
  { id: "paytm", label: "Paytm" },
  { id: "bhim", label: "BHIM" },
  { id: "other", label: "Other UPI app" },
];

/** Pick readable text for a background color. */
function onColor(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#1c1029" : "#ffffff";
}

function parseRedirect(url: string | null) {
  if (!url) return { signature: null as string | null, payment_id: null as string | null };
  try {
    const u = new URL(url, window.location.origin);
    return { signature: u.searchParams.get("og_signature"), payment_id: u.searchParams.get("og_payment_id") };
  } catch {
    return { signature: null, payment_id: null };
  }
}

export default function Checkout() {
  const { ps = "" } = useParams();
  const [sp] = useSearchParams();
  const embed = sp.get("embed") === "1";
  const base = `/api/checkout/${encodeURIComponent(ps)}`;

  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [view, setView] = useState<View>("loading");
  const [loadError, setLoadError] = useState<string>("");
  const [mobile] = useState(isMobileDevice);
  const [showQr, setShowQr] = useState(!isMobileDevice());
  const [launchedApp, setLaunchedApp] = useState<UpiApp | null>(null);
  const [utr, setUtr] = useState("");
  const [utrError, setUtrError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const attemptedRef = useRef(false);
  const finishedRef = useRef(false);
  const cancelDialogRef = useRef<HTMLDivElement>(null);

  // Cancel dialog: Escape closes it, Tab stays inside it, focus returns to the trigger afterwards.
  useEffect(() => {
    if (!confirmCancel) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmCancel(false);
      } else if (e.key === "Tab" && cancelDialogRef.current) {
        const f = cancelDialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [confirmCancel]);

  const brand = session?.merchant.brand_color && /^#[0-9a-f]{6}$/i.test(session.merchant.brand_color) ? session.merchant.brand_color : "#5f259f";
  const brandText = onColor(brand);
  const secondsLeft = useCountdown(status?.expires_at ?? session?.order.expires_at, status?.server_time ?? session?.server_time);

  // In embed mode the page sits inside the SDK's full-screen iframe.
  useEffect(() => {
    if (!embed) return;
    const prev = document.body.style.background;
    document.body.style.background = "transparent";
    return () => {
      document.body.style.background = prev;
    };
  }, [embed]);

  useEffect(() => {
    if (session) document.title = `Pay ${formatINR(session.order.amount_payable)} · ${session.merchant.name}`;
  }, [session]);

  const viewFromState = useCallback((orderStatus: string, paymentStatus: string | null | undefined): View | null => {
    if (orderStatus === "paid") return "paid";
    if (orderStatus === "expired") return "expired";
    if (orderStatus === "cancelled") return "cancelled";
    if (paymentStatus === "pending_verification") return "verifying";
    if (paymentStatus === "failed") return "failed";
    return null;
  }, []);

  // Load the session
  useEffect(() => {
    let alive = true;
    api
      .get<CheckoutSession>(base)
      .then((s) => {
        if (!alive) return;
        setSession(s);
        if (s.payment) attemptedRef.current = s.payment.status !== "failed";
        setView(viewFromState(s.order.status, s.payment?.status) ?? "pay");
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(e instanceof ApiError && e.status === 404 ? "This payment link is invalid or has been removed." : errorMessage(e));
        setView("error");
      });
    return () => {
      alive = false;
    };
  }, [base, viewFromState]);

  const pollStatus = useCallback(async () => {
    try {
      const st = await api.get<CheckoutStatus>(`${base}/status`);
      setStatus(st);
      const v = viewFromState(st.order_status, st.payment_status);
      setView((cur) => {
        if (cur === "loading" || cur === "error" || TERMINAL.includes(cur)) return cur;
        if (v === null) return cur === "failed" ? "pay" : cur;
        if (v === "failed" && cur === "pay" && !attemptedRef.current) return cur; // stale failure from an older attempt
        return v;
      });
    } catch {
      /* transient: keep polling */
    }
  }, [base, viewFromState]);

  // Poll every 2s until terminal
  const terminal = TERMINAL.includes(view);
  useEffect(() => {
    if (view === "loading" || view === "error" || terminal) return;
    pollStatus();
    const id = setInterval(pollStatus, 2000);
    return () => clearInterval(id);
  }, [view === "loading" || view === "error" || terminal, pollStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local expiry when the clock runs out
  useEffect(() => {
    if (session && secondsLeft === 0 && !terminal && view !== "loading" && view !== "error") {
      const t = setTimeout(() => pollStatus().then(() => setView((v) => (TERMINAL.includes(v) ? v : "expired"))), 1500);
      return () => clearTimeout(t);
    }
  }, [secondsLeft, session, terminal, view, pollStatus]);

  const attempt = useCallback(
    async (flow: "qr" | "intent", upi_app?: UpiApp) => {
      try {
        const r = await api.post<{ id?: string; status?: string } | { payment?: { id: string } }>(`${base}/attempt`, upi_app ? { flow, upi_app } : { flow });
        attemptedRef.current = true;
        return r;
      } catch (e) {
        if (e instanceof ApiError && e.code === "ORDER_NOT_PAYABLE") pollStatus();
        else setActionError(errorMessage(e));
        throw e;
      }
    },
    [base, pollStatus],
  );

  // Desktop: the QR is shown immediately, so register a QR attempt.
  useEffect(() => {
    if (view === "pay" && showQr && !attemptedRef.current && session) {
      attemptedRef.current = true;
      attempt("qr").catch(() => {
        attemptedRef.current = false;
      });
    }
  }, [view, showQr, session, attempt]);

  const openApp = async (app: UpiApp, href: string) => {
    if (!session) return;
    setActionError(null);
    setBusy(app);
    try {
      await attempt("intent", app);
    } catch {
      setBusy(null);
      return;
    }
    setBusy(null);
    setLaunchedApp(app);
    window.location.href = href;
  };

  const submitConfirm = async () => {
    const clean = utr.replace(/\s/g, "");
    if (clean && !/^\d{12}$/.test(clean)) {
      setUtrError("UTR is the 12-digit number in your UPI app's transaction details.");
      return;
    }
    setUtrError(null);
    setActionError(null);
    setBusy("confirm");
    try {
      if (!attemptedRef.current) await attempt(showQr ? "qr" : "intent", launchedApp ?? undefined);
      await api.post(`${base}/confirm`, clean ? { utr: clean } : {});
      setView("verifying");
      pollStatus();
    } catch (e) {
      if (e instanceof ApiError && e.field === "utr") setUtrError(e.message);
      else setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    try {
      await api.post(`${base}/cancel`);
      setView("cancelled");
      pollStatus();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  };

  const simulate = async (outcome: "success" | "failure") => {
    setBusy(`sim-${outcome}`);
    setActionError(null);
    try {
      if (!attemptedRef.current) await attempt(showQr ? "qr" : "intent", launchedApp ?? undefined).catch(() => undefined);
      await api.post(`${base}/simulate`, { outcome });
      await pollStatus();
      if (outcome === "failure") setView((v) => (TERMINAL.includes(v) ? v : "failed"));
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const retry = async () => {
    setActionError(null);
    attemptedRef.current = false;
    setLaunchedApp(null);
    setUtr("");
    setView("pay");
  };

  const postToParent = useCallback(
    (type: "success" | "failure" | "close") => {
      if (!embed || window.parent === window) return;
      const parsed = parseRedirect(status?.redirect_url ?? null);
      const result = status?.result ?? null;
      window.parent.postMessage(
        {
          source: "opengateway",
          type,
          order_id: session?.order.id ?? null,
          payment_id: result?.og_payment_id ?? parsed.payment_id ?? session?.payment?.id ?? null,
          signature: result?.og_signature ?? parsed.signature,
          status: result?.og_status ?? status?.order_status ?? session?.order.status ?? null,
        },
        "*",
      );
    },
    [embed, status, session],
  );

  const postRef = useRef(postToParent);
  postRef.current = postToParent;

  // Terminal side effects: notify the parent (embed) or follow redirect_url.
  useEffect(() => {
    if (!terminal || finishedRef.current || !session) return;
    // Make sure we have the redirect_url computed by the server for the final state.
    if (!status || !viewFromState(status.order_status, status.payment_status)) {
      pollStatus();
      return;
    }
    finishedRef.current = true;
    // Not tied to effect cleanup: later re-renders (e.g. the receipt refetch) must not cancel it.
    if (embed) {
      const type = view === "paid" ? "success" : "failure";
      setTimeout(() => postRef.current(type), view === "paid" ? 2200 : 1200);
    } else if (status.redirect_url) {
      const url = status.redirect_url;
      setTimeout(() => window.location.assign(url), view === "paid" ? 3000 : 4000);
    }
  }, [terminal, status, session, embed, view, postToParent, pollStatus, viewFromState]);

  // Refresh the session once paid so the receipt shows the captured payment's UTR.
  useEffect(() => {
    if (view !== "paid") return;
    api
      .get<CheckoutSession>(base)
      .then((s) => setSession(s))
      .catch(() => undefined);
  }, [view, base]);

  const amountParts = useMemo(() => (session ? splitINR(session.order.amount_payable) : ["", ""]), [session]);

  /* ----------------------------- render ----------------------------- */

  if (view === "loading") {
    return (
      <Shell embed={embed}>
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-pop md:max-w-[880px]">
          <div className="h-44 skeleton rounded-none" />
          <div className="space-y-3 p-6">
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-48 w-48" />
          </div>
        </div>
      </Shell>
    );
  }

  if (view === "error" || !session) {
    return (
      <Shell embed={embed}>
        <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-pop">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Payment page unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-ink-3">{loadError || "We couldn't load this payment."}</p>
          {embed && (
            <button onClick={() => postToParent("close")} className="mt-6 h-11 w-full rounded-xl border border-line-2 font-semibold hover:bg-paper">
              Close
            </button>
          )}
        </div>
      </Shell>
    );
  }

  const { order, merchant, upi } = session;
  const lowTime = secondsLeft > 0 && secondsLeft <= 60;
  const redirecting = !embed && !!status?.redirect_url;

  const header = (
    <div className="perforated relative px-6 md:after:hidden pt-6 pb-7 md:flex md:h-full md:flex-col md:px-8 md:pt-8 md:pb-8" style={{ background: brand, color: brandText }}>
      <div className="flex items-center gap-3">
        {merchant.logo_url ? (
          <img src={merchant.logo_url} alt="" className="size-11 rounded-xl bg-white object-contain p-1" />
        ) : (
          <span className="grid size-11 place-items-center rounded-xl bg-white/15 font-display text-lg font-bold">{merchant.name.slice(0, 1).toUpperCase()}</span>
        )}
        <div className="min-w-0">
          <div className="truncate font-display text-[17px] font-semibold">{merchant.name}</div>
          <div className="truncate text-xs opacity-75">{order.receipt ? `Receipt ${order.receipt}` : "UPI payment"}</div>
        </div>
      </div>

      <div className="mt-6 md:mt-10">
        <div className="text-xs font-semibold tracking-[0.14em] uppercase opacity-70">Amount payable</div>
        <div className="mt-1 font-display leading-none font-semibold tabular">
          <span className="text-[44px] md:text-[52px]">{amountParts[0]}</span>
          <span className="text-2xl opacity-70">{amountParts[1]}</span>
        </div>
        {order.description && <p className="mt-2 text-sm opacity-80">{order.description}</p>}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 md:mt-auto md:pt-10">
        {!terminal && (
          <span
            className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular", lowTime ? "bg-white text-danger" : "bg-black/15")}
            aria-live={lowTime ? "polite" : "off"}
          >
            <Clock3 className="size-3.5" /> {secondsLeft > 0 ? `Expires in ${fmtCountdown(secondsLeft)}` : "Expired"}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 font-mono text-[11px]">{order.id}</span>
      </div>

      <div className="mt-6 hidden items-start gap-2 text-xs leading-5 opacity-75 md:flex">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>
          You pay {merchant.name} directly at <span className="font-mono">{upi.vpa}</span>. OpenGateway never holds your money.
        </span>
      </div>
      <span className="notch-l md:hidden" />
      <span className="notch-r md:hidden" />
    </div>
  );

  let body: ReactNode;
  if (view === "paid") {
    body = (
      <Outcome
        tone="success"
        title="Payment successful"
        icon={<SuccessMark color={brand} />}
        lines={[
          ["Amount paid", formatINR(order.amount_payable)],
          ["UTR", session.payment?.utr ?? undefined],
          ["Order", order.id],
        ]}
        footer={redirecting ? <Redirecting text="Redirecting to merchant…" /> : embed ? <Redirecting text="Returning to merchant…" /> : <p className="text-sm text-ink-3">You can close this page now.</p>}
      />
    );
  } else if (view === "expired" || view === "cancelled") {
    body = (
      <Outcome
        tone="muted"
        title={view === "expired" ? "This payment has expired" : "Payment cancelled"}
        icon={view === "expired" ? <Clock3 className="size-8" /> : <Ban className="size-8" />}
        text={
          view === "expired"
            ? "The time to pay ran out. If money left your account, contact the merchant with your UTR — it went straight to their UPI ID."
            : "No payment was taken. You can return to the merchant and start again."
        }
        footer={redirecting ? <Redirecting text="Returning to merchant…" /> : merchant.support_email || merchant.support_phone ? <Support m={merchant} /> : null}
      />
    );
  } else if (view === "failed") {
    body = (
      <Outcome
        tone="danger"
        title="Payment not verified"
        icon={<XCircle className="size-8" />}
        text="We couldn't confirm this payment. If you haven't paid yet, try again. If money was debited, keep your UTR handy and contact the merchant."
        footer={
          <div className="flex w-full flex-col gap-2">
            <BrandButton brand={brand} text={brandText} onClick={retry}>
              Try again
            </BrandButton>
            {embed ? (
              <button onClick={() => postToParent("failure")} className="text-sm font-semibold text-ink-3 hover:text-ink">
                Return to merchant
              </button>
            ) : status?.redirect_url ? (
              <a href={status.redirect_url} className="text-center text-sm font-semibold text-ink-3 hover:text-ink">
                Return to merchant
              </a>
            ) : (
              <button onClick={() => setConfirmCancel(true)} className="text-sm font-semibold text-ink-3 hover:text-ink">
                Cancel payment
              </button>
            )}
          </div>
        }
      />
    );
  } else if (view === "verifying") {
    body = (
      <div className="flex flex-col items-center px-6 py-10 text-center md:py-16">
        <div className="relative grid size-20 place-items-center">
          <svg viewBox="0 0 80 80" className="absolute inset-0 size-full animate-spin [animation-duration:1.6s]">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#ece6f4" strokeWidth="5" />
            <circle cx="40" cy="40" r="36" fill="none" stroke={brand} strokeWidth="5" strokeLinecap="round" strokeDasharray="60 200" />
          </svg>
          <Smartphone className="size-7" style={{ color: brand }} />
        </div>
        <h2 className="mt-6 text-xl font-semibold">Verifying your payment…</h2>
        <p className="mt-2 max-w-xs text-sm leading-6 text-ink-3">
          We're matching your payment of <b className="text-ink">{formatINR(order.amount_payable)}</b> with {merchant.name}'s bank. This usually takes under a minute.
          Keep this page open.
        </p>
        {!terminal && secondsLeft > 0 && <p className="mt-4 text-xs text-ink-3 tabular">Order expires in {fmtCountdown(secondsLeft)}</p>}
      </div>
    );
  } else if (view === "confirm") {
    body = (
      <div className="px-6 py-7 md:px-8 md:py-10">
        <button onClick={() => setView("pay")} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-3 hover:text-ink">
          <ArrowLeft className="size-4" /> Back
        </button>
        <h2 className="text-xl font-semibold">Confirm your payment</h2>
        <p className="mt-1 text-sm leading-6 text-ink-3">
          Adding the UTR (UPI reference number) speeds up verification. You'll find it in your UPI app's transaction details.
        </p>
        <label htmlFor="utr" className="mt-5 block text-[13px] font-semibold text-ink-2">
          UTR / UPI reference no. <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <input
          id="utr"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={utrError ? true : undefined}
          aria-describedby={utrError ? "utr-error" : undefined}
          maxLength={14}
          placeholder="12-digit number, e.g. 412345678901"
          value={utr}
          onChange={(e) => {
            setUtr(e.target.value.replace(/[^\d ]/g, ""));
            setUtrError(null);
          }}
          className={cx(
            "mt-1.5 h-12 w-full rounded-xl border bg-white px-4 font-mono text-base tracking-wider focus:ring-4 focus:outline-none",
            utrError ? "border-danger" : "border-line-2 focus:border-ink-3",
          )}
          style={{ ["--tw-ring-color" as string]: `${brand}22` }}
        />
        {utrError && (
          <p id="utr-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
            {utrError}
          </p>
        )}
        <div className="mt-6">
          <BrandButton brand={brand} text={brandText} onClick={submitConfirm} loading={busy === "confirm"}>
            {utr.trim() ? "Submit UTR" : "Confirm without UTR"}
          </BrandButton>
        </div>
      </div>
    );
  } else {
    // pay
    body = (
      <div className="px-6 py-6 md:px-8 md:py-8">
        {showQr ? (
          <div className="flex flex-col items-center text-center">
            <h2 className="text-[17px] font-semibold">Scan with any UPI app</h2>
            <div className="relative mt-4 rounded-2xl border border-line p-4">
              <QR value={upi.uri} size={208} center={<span className="grid size-10 place-items-center rounded-lg bg-white shadow"><LogoMark className="size-7" /></span>} />
              <span className="pointer-events-none absolute inset-x-4 top-4 h-0.5 rounded-full opacity-60 motion-safe:animate-[scan_3.2s_ease-in-out_infinite]" style={{ background: brand }} />
            </div>
            <div className="mt-4 flex items-center gap-2">
              {(["gpay", "phonepe", "paytm", "bhim", "cred"] as const).map((a) => (
                <AppBadge key={a} app={a} size={30} />
              ))}
              <span className="text-xs font-semibold text-ink-3">& more</span>
            </div>
            <div className="mt-4 flex items-center gap-1 rounded-full bg-paper py-1 pr-1 pl-3 text-xs text-ink-2">
              <span className="truncate">
                {upi.payee_name} · <span className="font-mono">{upi.vpa}</span>
              </span>
              <CopyButton value={upi.vpa} />
            </div>
            {mobile && (
              <button onClick={() => setShowQr(false)} className="mt-3 text-sm font-semibold underline underline-offset-4" style={{ color: brand }}>
                Pay with a UPI app on this phone
              </button>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-[17px] font-semibold">Pay using a UPI app</h2>
            <p className="mt-0.5 text-sm text-ink-3">The amount and payee are filled in for you.</p>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {APPS.map((a) => {
                const href = intentFor(a.id, upi.uri);
                return (
                  <li key={a.id}>
                    {/* A real link, so the intent works even before JS finishes and can be long-pressed/copied. */}
                    <a
                      href={href}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!busy) openApp(a.id, href);
                      }}
                      aria-disabled={busy ? true : undefined}
                      className={cx(
                        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper focus-visible:bg-paper",
                        busy && "pointer-events-none opacity-60",
                      )}
                    >
                      <AppBadge app={a.id} />
                      <span className="flex-1 text-[15px] font-semibold">{a.label}</span>
                      {busy === a.id ? <Loader2 className="size-4 animate-spin text-ink-3" /> : <ChevronRight className="size-4 text-ink-3" />}
                    </a>
                  </li>
                );
              })}
            </ul>
            <button onClick={() => setShowQr(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-2 py-3 text-sm font-semibold text-ink-2 hover:bg-paper">
              <QrCode className="size-4" /> Show QR to scan from another phone
            </button>
          </div>
        )}

        {session.order.amount_payable !== session.order.amount && (
          <p className="mt-5 rounded-xl bg-paper px-3.5 py-2.5 text-xs leading-5 text-ink-2">
            Pay exactly <b>{formatINR(order.amount_payable)}</b>. The extra paisa lets us match your payment to this order instantly.
          </p>
        )}

        {launchedApp && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-sm text-ink-2" role="status">
            <Loader2 className="size-4 animate-spin" style={{ color: brand }} /> Waiting for payment in your UPI app…
          </p>
        )}

        <div className="mt-6 space-y-3">
          <BrandButton brand={brand} text={brandText} onClick={() => setView("confirm")}>
            I have paid
          </BrandButton>
          <button onClick={() => setConfirmCancel(true)} className="block w-full text-center text-sm font-semibold text-ink-3 hover:text-ink">
            Cancel payment
          </button>
        </div>
      </div>
    );
  }

  return (
    <Shell embed={embed} brand={brand}>
      <div className="mx-auto w-full max-w-md md:max-w-[880px]">
        {session.mode === "test" && !terminal && (
          <div className="mb-3 rounded-2xl border border-marigold/40 bg-marigold-soft p-3.5 text-sm text-[#8a4600]">
            <div className="flex items-center gap-2 font-semibold">
              <FlaskConical className="size-4" /> Test mode — no real money will move
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                onClick={() => simulate("success")}
                disabled={!!busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-credit px-3 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {busy === "sim-success" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Simulate success
              </button>
              <button
                onClick={() => simulate("failure")}
                disabled={!!busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-danger/30 bg-white px-3 text-[13px] font-semibold text-danger hover:bg-danger-soft disabled:opacity-60"
              >
                {busy === "sim-failure" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Simulate failure
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-3xl bg-white shadow-pop md:grid md:min-h-[520px] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" style={{ ["--notch-bg" as string]: embed ? "#ffffff" : "var(--color-paper)" }}>
          {header}
          <div className="relative min-w-0" aria-live="polite">
            {body}
            {actionError && (
              <p role="alert" className="mx-6 mb-6 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger md:mx-8">
                {actionError}
              </p>
            )}
          </div>
        </div>

        {!embed && (
          <footer className="mt-5 flex flex-col items-center gap-1 text-center text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Secured by <b className="font-display text-ink-2">OpenGateway</b> · UPI direct to merchant
            </span>
            {(merchant.support_email || merchant.support_phone) && (
              <span>
                Help: {merchant.support_email}
                {merchant.support_email && merchant.support_phone ? " · " : ""}
                {merchant.support_phone}
              </span>
            )}
          </footer>
        )}
      </div>

      {confirmCancel && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setConfirmCancel(false)}
        >
          <div
            ref={cancelDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            aria-describedby="cancel-desc"
            className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-pop sm:rounded-3xl"
            style={{ animation: "modal-in .2s ease-out" }}
          >
            <h2 id="cancel-title" className="text-lg font-semibold">
              Cancel this payment?
            </h2>
            <p id="cancel-desc" className="mt-1.5 text-sm leading-6 text-ink-3">If you've already paid, don't cancel — tap "I have paid" instead so we can verify it.</p>
            <div className="mt-5 flex flex-col gap-2">
              <button autoFocus onClick={() => setConfirmCancel(false)} className="h-11 rounded-xl border border-line-2 font-semibold hover:bg-paper">
                Continue paying
              </button>
              <button onClick={cancel} disabled={busy === "cancel"} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-danger font-semibold text-white disabled:opacity-60">
                {busy === "cancel" && <Loader2 className="size-4 animate-spin" />} Yes, cancel payment
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ---------------------------- pieces ---------------------------- */

function Shell({ children, embed, brand = "#5f259f" }: { children: ReactNode; embed: boolean; brand?: string }) {
  if (embed) {
    // checkout.js supplies the dimmed backdrop and close button around this iframe.
    return <div className="min-h-screen overflow-y-auto px-0 pt-14 pb-6 sm:px-4 sm:pt-16">{children}</div>;
  }
  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(180deg, ${brand}14 0, transparent 340px), var(--color-paper)` }}>
      <div className="mx-auto flex max-w-[880px] items-center justify-between px-4 pt-4 pb-3 md:pt-8 md:pb-5">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink-3">
          <LogoMark className="size-5" /> Checkout
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3">
          <ShieldCheck className="size-3.5" /> UPI
        </span>
      </div>
      <div className="px-3 pb-10 sm:px-4">{children}</div>
    </div>
  );
}

function BrandButton({ brand, text, onClick, loading, children }: { brand: string; text: string; onClick: () => void; loading?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)] transition-[filter] hover:brightness-110 disabled:opacity-70"
      style={{ background: brand, color: text }}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

function Outcome({
  tone,
  title,
  icon,
  text,
  lines,
  footer,
}: {
  tone: "success" | "danger" | "muted";
  title: string;
  icon: ReactNode;
  text?: string;
  lines?: [string, string | undefined | null][];
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center md:px-10 md:py-14">
      <div
        className={cx(
          "grid size-20 place-items-center rounded-full",
          tone === "danger" && "bg-danger-soft text-danger",
          tone === "muted" && "bg-paper text-ink-3",
        )}
        style={{ animation: "pop .45s cubic-bezier(.2,.7,.2,1) both" }}
      >
        {icon}
      </div>
      <h2 className="mt-5 text-2xl font-semibold">{title}</h2>
      {text && <p className="mt-2 max-w-sm text-sm leading-6 text-ink-3">{text}</p>}
      {lines && (
        <dl className="mt-6 w-full max-w-xs divide-y divide-dashed divide-line-2 rounded-2xl border border-line text-sm">
          {lines
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-ink-3">{k}</dt>
                <dd className={cx("font-semibold text-ink", (k === "UTR" || k === "Order") && "font-mono text-xs")}>{v}</dd>
              </div>
            ))}
        </dl>
      )}
      {footer && <div className="mt-6 flex w-full max-w-xs justify-center">{footer}</div>}
    </div>
  );
}

function SuccessMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 80" className="size-20" aria-hidden>
      <circle cx="40" cy="40" r="38" fill={color} />
      <path
        d="M24 41.5 35 52l21-24"
        fill="none"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="60"
        strokeDashoffset="60"
        style={{ animation: "draw .5s .25s ease-out forwards" }}
      />
    </svg>
  );
}

function Redirecting({ text }: { text: string }) {
  return (
    <p className="inline-flex items-center gap-2 text-sm text-ink-3" role="status">
      <Loader2 className="size-4 animate-spin" /> {text}
    </p>
  );
}

function Support({ m }: { m: CheckoutSession["merchant"] }) {
  return (
    <p className="text-xs text-ink-3">
      Need help? {m.support_email && <a className="font-semibold underline" href={`mailto:${m.support_email}`}>{m.support_email}</a>}
      {m.support_email && m.support_phone && " · "}
      {m.support_phone && <a className="font-semibold underline" href={`tel:${m.support_phone}`}>{m.support_phone}</a>}
    </p>
  );
}
