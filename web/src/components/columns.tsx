import type { Column } from "./DataTable";
import type { Order, Payment, Refund } from "../lib/types";
import { formatINR } from "../lib/money";
import { fmtDate, UPI_APP_LABEL, humanize } from "../lib/format";
import { IdCell, Mono, StatusBadge } from "./ui";

export function Amount({ paise, className }: { paise: number | null | undefined; className?: string }) {
  return <span className={`font-semibold tabular text-ink ${className ?? ""}`}>{formatINR(paise)}</span>;
}

export const orderColumns: Column<Order>[] = [
  { key: "id", header: "Order ID", cell: (o) => <IdCell id={o.id} /> },
  { key: "amount", header: "Amount", align: "right", cell: (o) => <Amount paise={o.amount_payable} /> },
  { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
  { key: "receipt", header: "Receipt", hideOnMobile: true, cell: (o) => (o.receipt ? <Mono>{o.receipt}</Mono> : <span className="text-ink-3">—</span>) },
  {
    key: "customer",
    header: "Customer",
    hideOnMobile: true,
    cell: (o) => <span className="text-ink-2">{o.customer?.name || o.customer?.phone || o.customer?.email || <span className="text-ink-3">—</span>}</span>,
  },
  { key: "created", header: "Created", cell: (o) => <span className="text-ink-2">{fmtDate(o.created_at)}</span> },
];

export const paymentColumns: Column<Payment>[] = [
  { key: "id", header: "Payment ID", cell: (p) => <IdCell id={p.id} /> },
  { key: "amount", header: "Amount", align: "right", cell: (p) => <Amount paise={p.amount} /> },
  { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
  { key: "order", header: "Order", hideOnMobile: true, cell: (p) => <Mono>{p.order_id}</Mono> },
  { key: "utr", header: "UTR", cell: (p) => (p.utr ? <Mono>{p.utr}</Mono> : <span className="text-ink-3">—</span>) },
  {
    key: "app",
    header: "Method",
    hideOnMobile: true,
    cell: (p) => (
      <span className="text-ink-2">
        UPI · {p.upi_app ? UPI_APP_LABEL[p.upi_app] ?? p.upi_app : humanize(p.flow)}
      </span>
    ),
  },
  { key: "verified", header: "Verified by", hideOnMobile: true, cell: (p) => <span className="text-ink-2">{humanize(p.verified_by)}</span> },
  { key: "created", header: "Created", cell: (p) => <span className="text-ink-2">{fmtDate(p.created_at)}</span> },
];

export const refundColumns: Column<Refund>[] = [
  { key: "id", header: "Refund ID", cell: (r) => <IdCell id={r.id} /> },
  { key: "amount", header: "Amount", align: "right", cell: (r) => <Amount paise={r.amount} /> },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  { key: "payment", header: "Payment", hideOnMobile: true, cell: (r) => <Mono>{r.payment_id}</Mono> },
  { key: "utr", header: "Refund UTR", hideOnMobile: true, cell: (r) => (r.utr ? <Mono>{r.utr}</Mono> : <span className="text-ink-3">—</span>) },
  { key: "created", header: "Created", cell: (r) => <span className="text-ink-2">{fmtDate(r.created_at)}</span> },
];
