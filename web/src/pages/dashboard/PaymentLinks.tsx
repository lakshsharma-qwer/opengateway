import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, ExternalLink, Link2, MessageCircle, Plus, Share2 } from "lucide-react";
import { useFetch } from "../../lib/hooks";
import { api, ApiError, errorMessage } from "../../lib/api";
import { useCan } from "../../lib/auth";
import type { Collection, PaymentLink } from "../../lib/types";
import { formatINR } from "../../lib/money";
import { fmtDate } from "../../lib/format";
import { Button, buttonClass, Card, Chips, CopyButton, EmptyState, ErrorBanner, IdCell, Input, PageHeader, StatusBadge } from "../../components/ui";
import { DataTable, Pagination, type Column } from "../../components/DataTable";
import { ConfirmModal, Drawer, Modal } from "../../components/Overlay";
import { AmountInput } from "../../components/AmountInput";
import { QR } from "../../components/QR";
import { useListParams } from "../../components/Filters";
import { useToast } from "../../components/Toast";
import { Amount } from "../../components/columns";

const COUNT = 25;
const STATUSES = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "paid", label: "Paid" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

export default function PaymentLinks() {
  const toast = useToast();
  const can = useCan();
  const p = useListParams();
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState<PaymentLink | null>(null);
  const [cancelling, setCancelling] = useState<PaymentLink | null>(null);
  const { data, loading, error, reload } = useFetch<Collection<PaymentLink>>("/api/payment-links", { status: p.get("status"), count: COUNT, skip: p.skip });

  const columns: Column<PaymentLink>[] = [
    { key: "id", header: "Link ID", cell: (l) => <IdCell id={l.id} /> },
    { key: "amount", header: "Amount", align: "right", cell: (l) => <Amount paise={l.amount} /> },
    { key: "status", header: "Status", cell: (l) => <StatusBadge status={l.status} /> },
    { key: "desc", header: "Description", hideOnMobile: true, cell: (l) => <span className="block max-w-56 truncate text-ink-2">{l.description || "—"}</span> },
    { key: "customer", header: "Customer", hideOnMobile: true, cell: (l) => <span className="text-ink-2">{l.customer?.name || l.customer?.phone || l.customer?.email || "—"}</span> },
    { key: "ref", header: "Reference", className: "hidden xl:table-cell", cell: (l) => <span className="font-mono text-xs text-ink-2">{l.reference_id || "—"}</span> },
    { key: "created", header: "Created", cell: (l) => <span className="text-ink-2">{fmtDate(l.created_at)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (l) => (
        <div className="flex justify-end gap-1">
          {l.order_id && l.status === "paid" && (
            <Link to={`/dashboard/orders/${l.order_id}`} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
              View order
            </Link>
          )}
          {l.status === "active" && (
            <>
              <Button size="sm" variant="ghost" icon={<Share2 className="size-3.5" />} onClick={() => setSharing(l)}>
                Share
              </Button>
              {can.write && (
                <Button size="sm" variant="ghost" aria-label="Cancel link" onClick={() => setCancelling(l)}>
                  <Ban className="size-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payment Links"
        subtitle="Send a link on WhatsApp or SMS. The customer pays your UPI ID from any app."
        actions={
          can.write && (
            <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Create payment link
            </Button>
          )
        }
      />
      <Card>
        <div className="border-b border-line p-4">
          <Chips options={STATUSES} value={p.get("status")} onChange={(v) => p.set({ status: v })} />
        </div>
        {error && (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        )}
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          rowKey={(l) => l.id}
          onRowClick={(l) => setSharing(l)}
          empty={
            <EmptyState
              icon={<Link2 className="size-5" />}
              title="No payment links yet"
              description="Create a link for a fixed amount and share it with your customer."
              action={can.write ? <Button onClick={() => setCreating(true)}>Create payment link</Button> : undefined}
            />
          }
        />
        {data && <Pagination skip={p.skip} count={COUNT} shown={data.items.length} hasMore={data.has_more} onChange={(skip) => p.set({ skip })} />}
      </Card>

      <CreateLinkModal
        open={creating}
        onClose={() => setCreating(false)}
        onDone={(l) => {
          reload();
          setSharing(l);
        }}
      />
      <ShareDrawer link={sharing} onClose={() => setSharing(null)} />
      <ConfirmModal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel this payment link?"
        description="Customers who open it will see that it's cancelled. This can't be undone."
        confirmLabel="Cancel link"
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            await api.post(`/api/payment-links/${cancelling.id}/cancel`);
            toast.success("Payment link cancelled");
            setCancelling(null);
            reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

function CreateLinkModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (l: PaymentLink) => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState<number | null>(null);
  const [f, setF] = useState({ description: "", reference_id: "", name: "", phone: "", email: "", expire_by: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!amount || amount < 100) e.amount = "Minimum amount is ₹1.00";
    else if (amount > 10000000) e.amount = "Maximum amount is ₹1,00,000.00";
    let expire_by: number | undefined;
    if (f.expire_by) {
      expire_by = Math.floor(new Date(f.expire_by).getTime() / 1000);
      if (expire_by <= Date.now() / 1000 + 60) e.expire_by = "Pick a time in the future";
    }
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Enter a valid email";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const customer = Object.fromEntries(
        (["name", "phone", "email"] as const).filter((k) => f[k].trim()).map((k) => [k, f[k].trim()]),
      );
      const l = await api.post<PaymentLink>("/api/payment-links", {
        amount,
        description: f.description.trim() || undefined,
        reference_id: f.reference_id.trim() || undefined,
        customer: Object.keys(customer).length ? customer : undefined,
        expire_by,
      });
      toast.success("Payment link created");
      onClose();
      onDone(l);
      setAmount(null);
      setF({ description: "", reference_id: "", name: "", phone: "", email: "", expire_by: "" });
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field.replace("customer.", "")]: err.message });
      else toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create payment link"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Create link
          </Button>
        </>
      }
    >
      <div className="grid gap-4 pb-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <AmountInput value={amount} onChange={setAmount} error={errors.amount} autoFocus />
        </div>
        <Input wrapClassName="sm:col-span-2" label="Description" optional placeholder="What is this payment for?" value={f.description} onChange={set("description")} error={errors.description} />
        <Input label="Reference ID" optional placeholder="Your invoice number" value={f.reference_id} onChange={set("reference_id")} error={errors.reference_id} />
        <Input label="Link expires" optional type="datetime-local" value={f.expire_by} onChange={set("expire_by")} error={errors.expire_by} />
        <div className="pt-2 text-[11px] font-semibold tracking-wider text-ink-3 uppercase sm:col-span-2">Customer</div>
        <Input label="Name" optional value={f.name} onChange={set("name")} />
        <Input label="Phone" optional type="tel" value={f.phone} onChange={set("phone")} error={errors.phone} />
        <Input wrapClassName="sm:col-span-2" label="Email" optional type="email" value={f.email} onChange={set("email")} error={errors.email} />
      </div>
    </Modal>
  );
}

function ShareDrawer({ link, onClose }: { link: PaymentLink | null; onClose: () => void }) {
  if (!link) return null;
  const msg = `Hi${link.customer?.name ? ` ${link.customer.name}` : ""}, please pay ${formatINR(link.amount)}${link.description ? ` for ${link.description}` : ""} using this UPI link: ${link.short_url}`;
  const phone = (link.customer?.phone ?? "").replace(/\D/g, "");
  const wa = `https://wa.me/${phone ? (phone.length === 10 ? `91${phone}` : phone) : ""}?text=${encodeURIComponent(msg)}`;
  return (
    <Drawer open onClose={onClose} title="Share payment link" subtitle={`${formatINR(link.amount)}${link.description ? ` · ${link.description}` : ""}`}>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <StatusBadge status={link.status} />
          {link.expire_by && <span className="text-xs text-ink-3">Expires {fmtDate(link.expire_by)}</span>}
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <div className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">Short link</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{link.short_url}</code>
            <CopyButton value={link.short_url} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href={wa} target="_blank" rel="noreferrer" className={buttonClass("primary", "md", "w-full bg-[#167a42] hover:bg-[#126536]")}>
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <a href={link.short_url} target="_blank" rel="noreferrer" className={buttonClass("outline", "md", "w-full")}>
            <ExternalLink className="size-4" /> Open link
          </a>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-line p-6">
          <QR value={link.short_url} size={196} />
          <p className="mt-3 text-center text-xs text-ink-3">Customers can scan this with their phone camera to open the link.</p>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-ink-3">Message preview</div>
          <p className="rounded-xl bg-[#e7f8ee] p-3 text-sm leading-6 text-ink-2">{msg}</p>
          <div className="mt-2">
            <CopyButton value={msg} label="Copy message" />
          </div>
        </div>
      </div>
    </Drawer>
  );
}
