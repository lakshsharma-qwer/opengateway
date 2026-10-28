import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CheckCheck, ExternalLink, Link2, MessageSquareText, ShieldX, Undo2 } from "lucide-react";
import { useFetch } from "../../lib/hooks";
import { api, errorMessage } from "../../lib/api";
import { useCan } from "../../lib/auth";
import type { OrderDetail as Detail, Payment, Refund } from "../../lib/types";
import { formatINR, splitINR } from "../../lib/money";
import { cx, fmtDate, humanize, UPI_APP_LABEL } from "../../lib/format";
import { Badge, Button, buttonClass, Card, CardHeader, CopyButton, DL, EmptyState, ErrorBanner, IdCell, Mono, Skeleton, StatusBadge } from "../../components/ui";
import { ConfirmModal } from "../../components/Overlay";
import { MarkPaidModal, ProcessRefundModal, RefundModal, RejectPaymentModal } from "../../components/Actions";
import { useToast } from "../../components/Toast";

const EVENT_LABEL: Record<string, string> = {
  "order.paid": "Order paid",
  "order.expired": "Order expired",
  "order.cancelled": "Order cancelled",
  "payment.pending_verification": "Customer says they paid",
  "payment.captured": "Payment captured",
  "payment.failed": "Payment failed",
  "refund.created": "Refund created",
  "refund.processed": "Refund processed",
  "payment_link.paid": "Payment link paid",
};

export default function OrderDetail() {
  const { id = "" } = useParams();
  const toast = useToast();
  const can = useCan();
  const { data, loading, error, reload } = useFetch<Detail>(`/api/orders/${encodeURIComponent(id)}`);
  const [modal, setModal] = useState<null | "paid" | "cancel" | "reject" | "refund">(null);
  const [processing, setProcessing] = useState<Refund | null>(null);
  const [failing, setFailing] = useState<Refund | null>(null);

  if (error) {
    return (
      <div>
        <BackLink />
        <ErrorBanner message={error} onRetry={reload} />
      </div>
    );
  }
  if (loading && !data) {
    return (
      <div>
        <BackLink />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-48 w-full" />
      </div>
    );
  }
  if (!data) return null;

  const { order, payments, refunds, events, observations } = data;
  const open = order.status === "created" || order.status === "attempted";
  const pending = payments.find((p) => p.status === "pending_verification");
  const captured = payments.find((p) => p.status === "captured");
  const refunded = refunds.filter((r) => r.status !== "failed").reduce((a, r) => a + r.amount, 0);
  const refundable = captured ? captured.amount - refunded : 0;
  const [rupees, paise] = splitINR(order.amount_payable);

  const timeline = [
    { id: "created", label: "Order created", at: order.created_at, tone: "neutral" as const },
    ...[...events]
      .sort((a, b) => a.created_at - b.created_at)
      .map((e) => ({
        id: e.id,
        label: EVENT_LABEL[e.type] ?? humanize(e.type),
        at: e.created_at,
        tone: e.type.endsWith("paid") || e.type.endsWith("captured") || e.type.endsWith("processed") ? ("success" as const) : e.type.endsWith("failed") || e.type.endsWith("expired") || e.type.endsWith("cancelled") ? ("danger" as const) : ("brand" as const),
        type: e.type,
      })),
  ];

  const failRefund = async () => {
    if (!failing) return;
    try {
      await api.post(`/api/refunds/${failing.id}/fail`);
      toast.success("Refund marked failed");
      setFailing(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <BackLink />

      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            <Badge tone={order.mode === "test" ? "warning" : "success"}>{order.mode === "test" ? "Test" : "Live"}</Badge>
            {order.payment_link_id && (
              <Badge tone="brand">
                <Link2 className="size-3" /> Payment link
              </Badge>
            )}
          </div>
          <div className="mt-2 font-display text-[40px] leading-none font-semibold tabular">
            {rupees}
            <span className="text-2xl text-ink-3">{paise}</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm text-ink-3">
            <Mono>{order.id}</Mono> <CopyButton value={order.id} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={order.checkout_url} label="Copy checkout link" />
          <a href={order.checkout_url} target="_blank" rel="noreferrer" className={buttonClass("outline", "sm")}>
            <ExternalLink className="size-3.5" /> Open checkout
          </a>
          {can.write && open && (
            <Button size="sm" variant="outline" icon={<Ban className="size-3.5" />} onClick={() => setModal("cancel")}>
              Cancel order
            </Button>
          )}
          {/* A credit can arrive after an order expired or was cancelled, so those can still be marked paid. */}
          {can.write && order.status !== "paid" && (
            <Button size="sm" variant={open ? "primary" : "outline"} icon={<CheckCheck className="size-3.5" />} onClick={() => setModal("paid")}>
              Mark as paid
            </Button>
          )}
          {can.refunds && captured && refundable > 0 && (
            <Button size="sm" variant="secondary" icon={<Undo2 className="size-3.5" />} onClick={() => setModal("refund")}>
              Issue refund
            </Button>
          )}
        </div>
      </div>

      {pending && can.write && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-marigold/40 bg-marigold-soft p-4 sm:flex-row sm:items-center">
          <div className="flex-1 text-sm text-[#7a3d00]">
            <b>The customer says they paid{pending.utr ? ` (UTR ${pending.utr})` : ""}.</b> Check your bank or UPI app for a credit of {formatINR(pending.amount)}, then confirm or reject.
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" icon={<ShieldX className="size-3.5" />} onClick={() => setModal("reject")}>
              Reject
            </Button>
            <Button size="sm" icon={<CheckCheck className="size-3.5" />} onClick={() => setModal("paid")}>
              Mark as paid
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <div className="p-5">
              <DL
                items={[
                  ["Order amount", formatINR(order.amount)],
                  ["Amount payable", <span key="ap" className="tabular">{formatINR(order.amount_payable)}{order.amount_payable !== order.amount && <span className="ml-1 text-xs text-ink-3">(unique amount)</span>}</span>],
                  ["Amount paid", formatINR(order.amount_paid)],
                  ["Receipt", order.receipt ? <Mono key="r">{order.receipt}</Mono> : "—"],
                  ["Paid to", <span key="v"><Mono>{order.vpa}</Mono> <span className="text-ink-3">· {order.payee_name}</span></span>],
                  ["UTR", order.utr ? <IdCell key="u" id={order.utr} /> : "—"],
                  ["Created", fmtDate(order.created_at)],
                  [order.status === "paid" ? "Paid at" : "Expires", fmtDate(order.status === "paid" ? order.paid_at : order.expires_at)],
                  ["Customer", [order.customer?.name, order.customer?.phone, order.customer?.email].filter(Boolean).join(" · ") || "—"],
                  ["Return URL", order.return_url ? <span key="ru" className="break-all">{order.return_url}</span> : "—"],
                ]}
              />
              {order.notes && Object.keys(order.notes).length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <div className="mb-2 text-xs font-medium text-ink-3">Notes</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(order.notes).map(([k, v]) => (
                      <span key={k} className="rounded-lg bg-paper px-2.5 py-1 font-mono text-xs">
                        <span className="text-ink-3">{k}:</span> {String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Payments" subtitle="Each time the customer opened checkout and started paying" />
            {payments.length ? (
              <ul className="divide-y divide-line">
                {payments.map((p) => (
                  <PaymentRow key={p.id} p={p} />
                ))}
              </ul>
            ) : (
              <EmptyState title="No payment attempts yet" description="A payment appears once the customer opens the checkout." className="py-8" />
            )}
          </Card>

          <Card>
            <CardHeader title="Refunds" />
            {refunds.length ? (
              <ul className="divide-y divide-line">
                {refunds.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular">{formatINR(r.amount)}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mt-0.5 text-xs text-ink-3">
                        <Mono>{r.id}</Mono> · {fmtDate(r.created_at)}
                        {r.utr && (
                          <>
                            {" "}
                            · UTR <Mono>{r.utr}</Mono>
                          </>
                        )}
                      </div>
                    </div>
                    {can.refunds && r.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setFailing(r)}>
                          Mark failed
                        </Button>
                        <Button size="sm" onClick={() => setProcessing(r)}>
                          Mark processed
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No refunds" className="py-8" />
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Timeline" />
            <ol className="relative px-5 py-4">
              {timeline.map((t, i) => (
                <li key={t.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < timeline.length - 1 && <span className="absolute top-4 left-[5px] h-full w-px bg-line-2" />}
                  <span
                    className={cx(
                      "relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-white",
                      t.tone === "success" && "bg-credit",
                      t.tone === "danger" && "bg-danger",
                      t.tone === "brand" && "bg-brand-500",
                      t.tone === "neutral" && "bg-ink-3",
                    )}
                  />
                  <div>
                    <div className="text-sm font-semibold text-ink">{t.label}</div>
                    <div className="text-xs text-ink-3">
                      {fmtDate(t.at)}
                      {"type" in t && t.type && <span className="ml-1.5 font-mono">{t.type}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Matched bank messages" subtitle="SMS credits linked to this order" />
            {observations.length ? (
              <ul className="divide-y divide-line">
                {observations.map((o) => (
                  <li key={o.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <MessageSquareText className="size-4 text-brand-600" />
                        {o.parsed.amount != null ? formatINR(o.parsed.amount) : "—"}
                      </span>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="mt-1.5 rounded-lg bg-paper p-2.5 font-mono text-[11.5px] leading-5 break-words text-ink-2">{o.raw_text}</p>
                    <div className="mt-1 text-xs text-ink-3">
                      {o.sender ?? "Unknown sender"} · {fmtDate(o.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No bank messages linked" description="When a forwarded credit SMS matches this order, it shows here." className="py-8" />
            )}
          </Card>
        </div>
      </div>

      <MarkPaidModal order={order} open={modal === "paid"} onClose={() => setModal(null)} onDone={reload} />
      {pending && <RejectPaymentModal paymentId={pending.id} open={modal === "reject"} onClose={() => setModal(null)} onDone={reload} />}
      <ConfirmModal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel this order?"
        description="The checkout stops accepting payments and your webhooks receive order.cancelled. This can't be undone."
        confirmLabel="Cancel order"
        onConfirm={async () => {
          try {
            await api.post(`/api/orders/${order.id}/cancel`);
            toast.success("Order cancelled");
            setModal(null);
            reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
      {captured && <RefundModal open={modal === "refund"} onClose={() => setModal(null)} onDone={reload} paymentId={captured.id} maxAmount={refundable} />}
      <ProcessRefundModal refund={processing} open={!!processing} onClose={() => setProcessing(null)} onDone={reload} />
      <ConfirmModal open={!!failing} onClose={() => setFailing(null)} title="Mark refund as failed?" description="Use this if the money couldn't be sent back. The amount becomes refundable again." confirmLabel="Mark failed" onConfirm={failRefund} />
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/dashboard/orders" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-3 hover:text-ink">
      <ArrowLeft className="size-4" /> Orders
    </Link>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold tabular">{formatINR(p.amount)}</span>
        <StatusBadge status={p.status} />
        <span className="text-xs text-ink-3">
          UPI · {p.upi_app ? UPI_APP_LABEL[p.upi_app] : p.flow === "qr" ? "QR scan" : humanize(p.flow)}
        </span>
        <span className="ml-auto inline-flex items-center">
          <Mono className="text-xs">{p.id}</Mono>
          <CopyButton value={p.id} />
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-3">
        <span>{fmtDate(p.created_at)}</span>
        {p.utr && (
          <span>
            UTR <Mono className="text-xs">{p.utr}</Mono>
          </span>
        )}
        {p.payer_vpa && (
          <span>
            From <Mono className="text-xs">{p.payer_vpa}</Mono>
          </span>
        )}
        {p.verified_by && <span>Verified by {p.verified_by}</span>}
        {p.error_code && (
          <span className="text-danger">
            {p.error_code}
            {p.error_description ? ` — ${p.error_description}` : ""}
          </span>
        )}
      </div>
    </li>
  );
}
