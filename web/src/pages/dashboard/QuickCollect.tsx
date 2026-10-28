import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, Check, CheckCheck, Clock3, Delete, FlaskConical, Loader2, Lock, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useCountdown, useInterval } from "../../lib/hooks";
import { useMode } from "../../lib/mode";
import { useCan } from "../../lib/auth";
import type { CheckoutSession, Order, OrderDetail } from "../../lib/types";
import { formatINR, paiseToRupeesString, splitINR } from "../../lib/money";
import { cx, fmtCountdown } from "../../lib/format";
import { Button, buttonClass, Card, EmptyState, Input, PageHeader } from "../../components/ui";
import { QR } from "../../components/QR";
import { LogoMark } from "../../components/Logo";
import { MarkPaidModal } from "../../components/Actions";
import { ConfirmModal } from "../../components/Overlay";
import { useToast } from "../../components/Toast";

const PRESETS = [5000, 10000, 20000, 50000, 100000];

function buildUpiUri(o: Order) {
  const q = new URLSearchParams({ pa: o.vpa, pn: o.payee_name, am: (o.amount_payable / 100).toFixed(2), cu: "INR", tn: o.description || o.id, tr: o.id });
  return `upi://pay?${q.toString()}`;
}

export default function QuickCollect() {
  const toast = useToast();
  const { mode } = useMode();
  const can = useCan();
  const [digits, setDigits] = useState(""); // rupees typed on keypad, as a string with optional "."
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [uri, setUri] = useState("");
  const [utr, setUtr] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  const [modal, setModal] = useState<null | "paid" | "cancel">(null);

  const paise = (() => {
    if (!digits) return 0;
    const [r, p = ""] = digits.split(".");
    return Number(r || 0) * 100 + Number((p + "00").slice(0, 2));
  })();

  const press = (k: string) => {
    setDigits((d) => {
      if (k === "back") return d.slice(0, -1);
      if (k === ".") return d.includes(".") ? d : (d || "0") + ".";
      if (d.includes(".") && d.split(".")[1].length >= 2) return d;
      if (!d.includes(".") && d.replace(/^0+/, "").length >= 6) return d;
      return d === "0" ? k : d + k;
    });
  };

  // Physical keyboard support for the keypad
  useEffect(() => {
    if (order || !can.write) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === ".") press(".");
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Enter" && paise >= 100) create();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const create = async () => {
    if (paise < 100) return toast.error("Minimum amount is ₹1.00");
    if (paise > 10000000) return toast.error("Maximum amount is ₹1,00,000.00");
    setBusy(true);
    try {
      const o = await api.post<Order>("/api/orders", { amount: paise, description: note.trim() || undefined });
      setOrder(o);
      setUtr(null);
      setUri(buildUpiUri(o));
      // Use the server's canonical UPI URI and mark the QR as shown.
      const base = `/api/checkout/${o.payment_session_id}`;
      api.get<CheckoutSession>(base).then((s) => s.upi?.uri && setUri(s.upi.uri)).catch(() => undefined);
      api.post(`${base}/attempt`, { flow: "qr" }).catch(() => undefined);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const poll = async () => {
    if (!order) return;
    try {
      const d = await api.get<OrderDetail>(`/api/orders/${order.id}`);
      if (d.order.status !== order.status) setOrder(d.order);
      const cap = d.payments.find((p) => p.status === "captured");
      if (cap?.utr || d.order.utr) setUtr(cap?.utr ?? d.order.utr);
    } catch {
      /* keep polling */
    }
  };
  const live = order && (order.status === "created" || order.status === "attempted");
  useInterval(poll, live ? 2000 : null);

  const left = useCountdown(order?.expires_at);
  useEffect(() => {
    if (order && live && left === 0) poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const reset = () => {
    setOrder(null);
    setDigits("");
    setNote("");
    setBig(false);
  };

  const simulate = async () => {
    if (!order) return;
    try {
      await api.post(`/api/checkout/${order.payment_session_id}/simulate`, { outcome: "success" });
      poll();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (order) {
    const [r, p] = splitINR(order.amount_payable);
    const paid = order.status === "paid";
    const ended = order.status === "expired" || order.status === "cancelled";
    return (
      <div className={cx(big && "fixed inset-0 z-[90] overflow-y-auto bg-paper p-4 sm:p-8")}>
        <div className="mx-auto max-w-lg">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between bg-brand-600 px-5 py-3 text-white">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <LogoMark className="size-6" /> {order.payee_name}
              </span>
              <button onClick={() => setBig((b) => !b)} className="grid size-8 place-items-center rounded-lg hover:bg-white/15" aria-label={big ? "Exit full screen" : "Full screen for customer"}>
                {big ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            </div>
            <div className="flex flex-col items-center px-6 py-7 text-center">
              <div className="font-display text-[56px] leading-none font-semibold tabular">
                {r}
                <span className="text-3xl text-ink-3">{p}</span>
              </div>
              {order.description && <p className="mt-1 text-sm text-ink-3">{order.description}</p>}

              {paid ? (
                <div className="my-8 flex flex-col items-center" role="status">
                  <div className="grid size-24 place-items-center rounded-full bg-credit text-white" style={{ animation: "pop .45s both" }}>
                    <Check className="size-12" strokeWidth={3} />
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-credit">Payment received</div>
                  {utr && <div className="mt-1 font-mono text-sm text-ink-3">UTR {utr}</div>}
                </div>
              ) : ended ? (
                <div className="my-8 flex flex-col items-center text-ink-3" role="status">
                  {order.status === "expired" ? <Clock3 className="size-12" /> : <Ban className="size-12" />}
                  <div className="mt-3 text-xl font-semibold text-ink">{order.status === "expired" ? "QR expired" : "Collection cancelled"}</div>
                </div>
              ) : (
                <>
                  <div className="mt-6 rounded-3xl border-2 border-brand-100 p-4" style={{ animation: "pulse-ring 2s infinite" }}>
                    <QR value={uri} size={big ? 300 : 248} center={<span className="grid size-11 place-items-center rounded-xl bg-white shadow"><LogoMark className="size-8" /></span>} />
                  </div>
                  <p className="mt-4 text-[15px] font-semibold">Scan with any UPI app</p>
                  <p className="mt-0.5 font-mono text-xs text-ink-3">{order.vpa}</p>
                  <div className={cx("mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular", left <= 60 ? "bg-danger-soft text-danger" : "bg-paper text-ink-2")}>
                    <Clock3 className="size-4" /> {fmtCountdown(left)}
                  </div>
                  <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink-3" role="status">
                    <Loader2 className="size-4 animate-spin text-brand-600" /> Waiting for payment…
                  </p>
                  {order.amount_payable !== order.amount && <p className="mt-2 text-xs text-ink-3">Customer should pay exactly {formatINR(order.amount_payable)} (unique amount for instant matching).</p>}
                </>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2 border-t border-line px-5 py-4">
              {live && (
                <>
                  <Button variant="outline" size="sm" icon={<Ban className="size-3.5" />} onClick={() => setModal("cancel")}>
                    Cancel
                  </Button>
                  <Button variant="outline" size="sm" icon={<CheckCheck className="size-3.5" />} onClick={() => setModal("paid")}>
                    Mark as paid
                  </Button>
                  {mode === "test" && (
                    <Button variant="secondary" size="sm" icon={<FlaskConical className="size-3.5" />} onClick={simulate}>
                      Simulate payment
                    </Button>
                  )}
                </>
              )}
              {!live && (
                <>
                  <Link to={`/dashboard/orders/${order.id}`} className={buttonClass("outline", "sm")}>
                    View order
                  </Link>
                  <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={reset}>
                    New collection
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
        <MarkPaidModal order={order} open={modal === "paid"} onClose={() => setModal(null)} onDone={poll} />
        <ConfirmModal
          open={modal === "cancel"}
          onClose={() => setModal(null)}
          title="Cancel this collection?"
          description="The QR stops accepting payments."
          confirmLabel="Cancel collection"
          onConfirm={async () => {
            try {
              await api.post(`/api/orders/${order.id}/cancel`);
              setModal(null);
              poll();
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        />
      </div>
    );
  }

  if (!can.write) {
    return (
      <div>
        <PageHeader title="Quick Collect" subtitle="Enter an amount and show the QR to your customer. It turns green the moment the payment is verified." />
        <Card className="mx-auto max-w-md">
          <EmptyState icon={<Lock className="size-5" />} title="Read-only access" description="Your role can view payments but can't create collections. Ask an owner or admin to change your role." />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Quick Collect" subtitle="Enter an amount and show the QR to your customer. It turns green the moment the payment is verified." />
      <div className="mx-auto max-w-md">
        <Card className="p-5 sm:p-6">
          <div className="rounded-2xl bg-paper px-4 py-5 text-center" aria-live="polite">
            <div className="text-xs font-semibold tracking-wider text-ink-3 uppercase">Amount</div>
            <div className={cx("mt-1 font-display text-5xl font-semibold tabular", !digits && "text-ink-3/50")}>₹{digits ? Number(digits.split(".")[0]).toLocaleString("en-IN") + (digits.includes(".") ? "." + digits.split(".")[1] : "") : "0"}</div>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {PRESETS.map((v) => (
              <button key={v} onClick={() => setDigits(paiseToRupeesString(v))} className="rounded-full border border-line-2 bg-white px-3 py-1 text-xs font-semibold text-ink-2 hover:border-brand-300">
                {formatINR(v, { noDecimals: true })}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((k) => (
              <button
                key={k}
                onClick={() => press(k)}
                aria-label={k === "back" ? "Delete digit" : k}
                className="grid h-14 place-items-center rounded-xl bg-white font-display text-2xl font-semibold text-ink ring-1 ring-line transition-colors hover:bg-brand-50 active:bg-brand-100"
              >
                {k === "back" ? <Delete className="size-5" /> : k}
              </button>
            ))}
          </div>
          <Input wrapClassName="mt-4" label="Note" optional placeholder="e.g. Table 4, 2 coffees" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
          <Button size="lg" className="mt-5 w-full" onClick={create} loading={busy} disabled={paise < 100}>
            {paise >= 100 ? `Show QR for ${formatINR(paise)}` : "Enter an amount"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
