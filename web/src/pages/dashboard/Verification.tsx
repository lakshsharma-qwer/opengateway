import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Link2, MessageSquareText, Plus, RefreshCw, Smartphone, Trash2, EyeOff, Search } from "lucide-react";
import { useFetch, useDebounced } from "../../lib/hooks";
import { api, errorMessage, itemsOf } from "../../lib/api";
import { useCan } from "../../lib/auth";
import { useMode } from "../../lib/mode";
import type { Collection, Observation, Observer, Order } from "../../lib/types";
import { formatINR } from "../../lib/money";
import { cx, fmtDate, fmtRelative } from "../../lib/format";
import { Badge, Button, Card, CardHeader, Chips, CopyButton, EmptyState, ErrorBanner, Input, Mono, PageHeader, StatusBadge, Tabs } from "../../components/ui";
import { DataTable, Pagination, type Column } from "../../components/DataTable";
import { ConfirmModal, Modal } from "../../components/Overlay";
import { ForwarderInstructions, SmsPlayground } from "../../components/Sms";
import { useListParams } from "../../components/Filters";
import { useToast } from "../../components/Toast";

type Tab = "observers" | "credits" | "playground";

export default function Verification() {
  const p = useListParams();
  const tab = (p.get("tab") || "credits") as Tab;
  const unmatched = useFetch<Collection<Observation>>("/api/observations", { status: "unmatched", count: 100 });
  const unmatchedCount = unmatched.data ? itemsOf(unmatched.data).length : undefined;

  return (
    <div>
      <PageHeader
        title="Verification"
        subtitle="How OpenGateway confirms money reached your account: forwarded bank SMS, matched to orders by amount or UTR."
      />
      <Tabs<Tab>
        className="mb-5"
        value={tab}
        onChange={(t) => p.set({ tab: t === "credits" ? "" : t })}
        tabs={[
          { value: "credits", label: "Bank credits", count: unmatchedCount || undefined },
          { value: "observers", label: "SMS forwarders" },
          { value: "playground", label: "Parse playground" },
        ]}
      />
      {tab === "observers" && <Observers />}
      {tab === "credits" && <Credits onChange={unmatched.reload} />}
      {tab === "playground" && (
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold">Test the SMS parser</h2>
          <p className="mb-5 text-sm text-ink-3">Paste a bank or UPI app message to see the amount, UTR and payer we'd extract. Nothing is stored.</p>
          <SmsPlayground />
        </Card>
      )}
    </div>
  );
}

/* ----------------------------- Observers ----------------------------- */

function Observers() {
  const toast = useToast();
  const can = useCan();
  const { mode } = useMode();
  const { data, loading, error, reload } = useFetch<Collection<Observer>>("/api/observers");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("My phone");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Observer | null>(null);
  const [rotating, setRotating] = useState<Observer | null>(null);
  const [deleting, setDeleting] = useState<Observer | null>(null);
  const items = itemsOf(data);

  const create = async () => {
    setBusy(true);
    try {
      const o = await api.post<Observer>("/api/observers", { name: name.trim() || "My phone", mode });
      setCreating(false);
      setRevealed(o);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="SMS forwarders"
          subtitle={`Phones that forward ${mode} bank credit messages to OpenGateway`}
          action={
            can.write && (
              <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                Add forwarder
              </Button>
            )
          }
        />
        {error && (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        )}
        {loading && !data ? (
          <div className="space-y-3 p-5">
            <div className="skeleton h-16" />
            <div className="skeleton h-16" />
          </div>
        ) : items.length ? (
          <ul className="divide-y divide-line">
            {items.map((o) => {
              const fresh = o.last_seen_at && Date.now() / 1000 - o.last_seen_at < 86400;
              return (
                <li key={o.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className={cx("grid size-10 shrink-0 place-items-center rounded-xl", fresh ? "bg-credit-soft text-credit" : "bg-paper text-ink-3")}>
                    <Smartphone className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{o.name}</span>
                      {!o.active && <Badge>Inactive</Badge>}
                      <Badge tone={fresh ? "success" : "neutral"} dot>
                        {o.last_seen_at ? `Last seen ${fmtRelative(o.last_seen_at)}` : "Never seen"}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                      <Mono className="text-xs">{o.id}</Mono> · added {fmtDate(o.created_at, false)}
                    </div>
                    {o.ingest_url && (
                      <div className="mt-2 flex max-w-xl items-center gap-1 rounded-lg bg-paper px-2.5 py-1">
                        <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2">{o.ingest_url}</code>
                        <CopyButton value={o.ingest_url} />
                      </div>
                    )}
                  </div>
                  {can.write && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" icon={<RefreshCw className="size-3.5" />} onClick={() => setRotating(o)}>
                        {o.ingest_url ? "Rotate token" : "Get new URL"}
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={`Delete ${o.name}`} onClick={() => setDeleting(o)}>
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<MessageSquareText className="size-5" />}
            title="No SMS forwarders yet"
            description="Add one to verify payments automatically. Without it you can still confirm each payment by hand."
            action={can.write ? <Button onClick={() => setCreating(true)}>Add forwarder</Button> : undefined}
          />
        )}
      </Card>
      <p className="mt-3 text-xs text-ink-3">For security, the ingest URL with its token is shown in full only when created or rotated. Rotating breaks the old URL immediately.</p>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        size="sm"
        title="Add SMS forwarder"
        description={`Creates a private ${mode}-mode ingest URL for one phone.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={create} loading={busy}>
              Create
            </Button>
          </>
        }
      >
        <div className="pb-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} hint="e.g. Shop counter phone" />
        </div>
      </Modal>

      <Modal open={!!revealed} onClose={() => setRevealed(null)} size="lg" title={`Connect “${revealed?.name ?? ""}”`} description="Copy the URL into your SMS forwarder app now." footer={<Button onClick={() => setRevealed(null)}>Done</Button>}>
        {revealed?.ingest_url && <ForwarderInstructions ingestUrl={revealed.ingest_url} />}
      </Modal>

      <ConfirmModal
        open={!!rotating}
        onClose={() => setRotating(null)}
        tone="primary"
        title="Rotate token?"
        description="The current URL stops working right away. Update your forwarder app with the new URL."
        confirmLabel="Rotate token"
        onConfirm={async () => {
          if (!rotating) return;
          try {
            const o = await api.post<Observer>(`/api/observers/${rotating.id}/rotate-token`);
            setRotating(null);
            setRevealed({ ...rotating, ...o });
            reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="Messages from this phone will no longer be accepted. Past bank credits stay in your history."
        confirmLabel="Delete forwarder"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.del(`/api/observers/${deleting.id}`);
            toast.success("Forwarder deleted");
            setDeleting(null);
            reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </>
  );
}

/* ----------------------------- Bank credits ----------------------------- */

const OBS_STATUSES = [
  { value: "unmatched", label: "Unmatched" },
  { value: "matched", label: "Matched" },
  { value: "ignored", label: "Ignored" },
  { value: "duplicate", label: "Duplicate" },
  { value: "all", label: "All" },
];

function Credits({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  const can = useCan();
  const p = useListParams();
  const status = p.get("ostatus") || "unmatched";
  const { data, loading, error, reload } = useFetch<Collection<Observation>>("/api/observations", { status: status === "all" ? undefined : status, count: 25, skip: p.skip });
  const [attaching, setAttaching] = useState<Observation | null>(null);
  const [ignoring, setIgnoring] = useState<Observation | null>(null);

  const refresh = () => {
    reload();
    onChange();
  };

  const columns: Column<Observation>[] = [
    { key: "at", header: "Received", cell: (o) => <span className="text-ink-2">{fmtDate(o.created_at)}</span> },
    { key: "amount", header: "Amount", align: "right", cell: (o) => <span className="font-semibold tabular">{o.parsed?.amount != null ? formatINR(o.parsed.amount) : "—"}</span> },
    { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
    { key: "utr", header: "UTR", cell: (o) => (o.parsed?.utr ? <Mono>{o.parsed.utr}</Mono> : <span className="text-ink-3">—</span>) },
    { key: "payer", header: "From", className: "hidden xl:table-cell", cell: (o) => <span className="font-mono text-xs text-ink-2">{o.parsed?.payer_vpa ?? o.sender ?? "—"}</span> },
    {
      key: "text",
      header: "Message",
      hideOnMobile: true,
      cell: (o) => (
        <span title={o.raw_text} className="block max-w-40 truncate font-mono text-xs text-ink-3 xl:max-w-56">
          {o.raw_text}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (o) =>
        o.status === "unmatched" && can.write ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" aria-label="Ignore credit" title="Ignore" onClick={() => setIgnoring(o)}>
              <EyeOff className="size-3.5" />
            </Button>
            <Button size="sm" variant="secondary" icon={<Link2 className="size-3.5" />} onClick={() => setAttaching(o)}>
              Attach
            </Button>
          </div>
        ) : o.order_id ? (
          <Link to={`/dashboard/orders/${o.order_id}`} className="font-mono text-xs text-brand-700 hover:underline">
            {o.order_id}
          </Link>
        ) : null,
    },
  ];

  return (
    <Card>
      <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <Chips options={OBS_STATUSES} value={status} onChange={(v) => p.set({ ostatus: v === "unmatched" ? "" : v })} />
        <p className="text-xs text-ink-3">Unmatched credits had no single open order with that exact amount or UTR.</p>
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
        rowKey={(o) => o.id}
        empty={
          <EmptyState
            icon={<MessageSquareText className="size-5" />}
            title={status === "unmatched" ? "All bank credits are matched" : "Nothing here"}
            description={status === "unmatched" ? "When a forwarded credit can't be matched to exactly one order, it waits here for you." : undefined}
          />
        }
      />
      {data && <Pagination skip={p.skip} count={25} shown={data.items.length} hasMore={data.has_more} onChange={(skip) => p.set({ skip })} />}

      <AttachModal obs={attaching} onClose={() => setAttaching(null)} onDone={refresh} />
      <ConfirmModal
        open={!!ignoring}
        onClose={() => setIgnoring(null)}
        tone="primary"
        title="Ignore this credit?"
        description="Use this for money that isn't for an order (e.g. a transfer from a friend). It won't be matched later."
        confirmLabel="Ignore credit"
        onConfirm={async () => {
          if (!ignoring) return;
          try {
            await api.post(`/api/observations/${ignoring.id}/ignore`);
            toast.success("Credit ignored");
            setIgnoring(null);
            refresh();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </Card>
  );
}

function AttachModal({ obs, onClose, onDone }: { obs: Observation | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setSelected(null), [obs]);

  useEffect(() => {
    if (!obs) return;
    let alive = true;
    setOrders(null);
    Promise.all(
      // Open orders first; expired/cancelled ones can still receive a late credit.
      ["attempted", "created", "expired", "cancelled"].map((status) => api.get<Collection<Order>>("/api/orders", { status, q: dq, count: 50 }).then(itemsOf).catch(() => [] as Order[])),
    ).then(([a, c, e, x]) => {
      if (!alive) return;
      const amt = obs.parsed?.amount ?? 0;
      const rank = (o: Order) => (o.status === "attempted" || o.status === "created" ? 0 : 1);
      const all = [...a, ...c, ...e, ...x].sort(
        (p, q) => rank(p) - rank(q) || Math.abs(p.amount_payable - amt) - Math.abs(q.amount_payable - amt) || q.created_at - p.created_at,
      );
      setOrders(all);
      // Keep the user's choice while it's still in the results.
      setSelected((cur) => (cur && all.some((o) => o.id === cur) ? cur : null));
    });
    return () => {
      alive = false;
    };
  }, [obs, dq]);

  useEffect(() => {
    if (!obs) setQ("");
  }, [obs]);

  const attach = async () => {
    if (!obs || !selected) return;
    setBusy(true);
    try {
      await api.post(`/api/observations/${obs.id}/attach`, { order_id: selected });
      toast.success("Credit attached. The order is now paid.");
      onClose();
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!obs}
      onClose={onClose}
      size="lg"
      title="Attach credit to an order"
      description={obs ? `Received ${obs.parsed?.amount != null ? formatINR(obs.parsed.amount) : "an unknown amount"}${obs.parsed?.utr ? ` · UTR ${obs.parsed.utr}` : ""}. The chosen order will be marked paid.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={attach} loading={busy} disabled={!selected}>
            Attach and mark paid
          </Button>
        </>
      }
    >
      <div className="pb-2">
        <Input leading={<Search className="size-4" />} placeholder="Search orders by ID, receipt, phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
        <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-line" role="radiogroup" aria-label="Orders">
          {orders === null ? (
            <div className="space-y-2 p-3">
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </div>
          ) : orders.length ? (
            orders.map((o) => {
              const exact = o.amount_payable === obs?.parsed?.amount;
              return (
                <label key={o.id} className={cx("flex cursor-pointer items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-0 hover:bg-paper", selected === o.id && "bg-brand-50")}>
                  <input type="radio" name="attach-order" className="accent-brand-600" checked={selected === o.id} onChange={() => setSelected(o.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular">{formatINR(o.amount_payable)}</span>
                      {exact && <Badge tone="success">Exact amount</Badge>}
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="truncate text-xs text-ink-3">
                      <span className="font-mono">{o.id}</span>
                      {o.receipt && ` · ${o.receipt}`} · {fmtDate(o.created_at)}
                    </div>
                  </div>
                </label>
              );
            })
          ) : (
            <p className="p-6 text-center text-sm text-ink-3">No matching orders found.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
