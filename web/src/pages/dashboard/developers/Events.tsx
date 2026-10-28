import { useState } from "react";
import { Link } from "react-router-dom";
import { ListTree } from "lucide-react";
import { useFetch } from "../../../lib/hooks";
import { EVENT_TYPES, type Collection, type OgEvent } from "../../../lib/types";
import { fmtDate } from "../../../lib/format";
import { Badge, Card, EmptyState, ErrorBanner, IdCell, PageHeader, Select } from "../../../components/ui";
import { DataTable, Pagination } from "../../../components/DataTable";
import { Drawer } from "../../../components/Overlay";
import { useListParams } from "../../../components/Filters";

export function JsonBlock({ value }: { value: unknown }) {
  return <pre className="overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[12px] leading-5 text-brand-100">{JSON.stringify(value, null, 2)}</pre>;
}

function orderIdOf(e: OgEvent): string | null {
  const d = e.data as { order?: { id?: string }; payment?: { order_id?: string }; refund?: { order_id?: string } };
  return d?.order?.id ?? d?.payment?.order_id ?? d?.refund?.order_id ?? null;
}

export default function Events() {
  const p = useListParams();
  const { data, loading, error, reload } = useFetch<Collection<OgEvent>>("/api/events", { type: p.get("type"), count: 25, skip: p.skip });
  const [open, setOpen] = useState<OgEvent | null>(null);
  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Everything that happened in your account. Each event is also sent to matching webhooks."
        actions={
          <Select
            aria-label="Event type"
            value={p.get("type")}
            onChange={(e) => p.set({ type: e.target.value })}
            options={[{ value: "", label: "All event types" }, ...EVENT_TYPES.map((t) => ({ value: t, label: t }))]}
            wrapClassName="w-60"
          />
        }
      />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <Card>
        <DataTable
          columns={[
            { key: "type", header: "Event", cell: (e) => <Badge tone="brand" className="font-mono">{e.type}</Badge> },
            { key: "id", header: "Event ID", cell: (e) => <IdCell id={e.id} /> },
            {
              key: "order",
              header: "Order",
              hideOnMobile: true,
              cell: (e) => {
                const id = orderIdOf(e);
                return id ? (
                  <Link onClick={(ev) => ev.stopPropagation()} to={`/dashboard/orders/${id}`} className="font-mono text-xs text-brand-700 hover:underline">
                    {id}
                  </Link>
                ) : (
                  <span className="text-ink-3">—</span>
                );
              },
            },
            { key: "at", header: "Created", cell: (e) => <span className="text-ink-2">{fmtDate(e.created_at)}</span> },
          ]}
          rows={data?.items}
          loading={loading}
          rowKey={(e) => e.id}
          onRowClick={setOpen}
          empty={<EmptyState icon={<ListTree className="size-5" />} title="No events yet" description="Events appear as orders are paid, expire or get refunded." />}
        />
        {data && <Pagination skip={p.skip} count={25} shown={data.items.length} hasMore={data.has_more} onChange={(skip) => p.set({ skip })} />}
      </Card>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.type ?? ""} subtitle={open ? `${open.id} · ${fmtDate(open.created_at)}` : undefined} width="lg">
        {open && <JsonBlock value={open} />}
      </Drawer>
    </div>
  );
}
