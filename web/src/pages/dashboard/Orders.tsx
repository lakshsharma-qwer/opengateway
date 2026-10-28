import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Plus, Receipt } from "lucide-react";
import { useFetch } from "../../lib/hooks";
import { downloadFile, errorMessage } from "../../lib/api";
import { useCan } from "../../lib/auth";
import type { Collection, Order } from "../../lib/types";
import { Button, Card, Chips, EmptyState, ErrorBanner, PageHeader } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { orderColumns } from "../../components/columns";
import { DateRange, SearchBox, useListParams } from "../../components/Filters";
import { CreateOrderModal } from "../../components/Actions";
import { useToast } from "../../components/Toast";

const COUNT = 25;
const STATUSES = [
  { value: "", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "attempted", label: "Attempted" },
  { value: "created", label: "Created" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

export default function Orders() {
  const nav = useNavigate();
  const toast = useToast();
  const can = useCan();
  const p = useListParams();
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { data, loading, error, reload } = useFetch<Collection<Order>>("/api/orders", {
    status: p.get("status"),
    q: p.get("q"),
    from: p.from,
    to: p.to,
    count: COUNT,
    skip: p.skip,
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile("/api/reports/export", { type: "orders", from: p.from, to: p.to }, "orders.csv");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const filtered = !!(p.get("status") || p.get("q") || p.from || p.to);

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Every checkout you've created, and where it stands."
        actions={
          <>
            <Button variant="outline" icon={<Download className="size-4" />} onClick={exportCsv} loading={exporting}>
              Export
            </Button>
            {can.write && (
              <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                Create order
              </Button>
            )}
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <Chips options={STATUSES} value={p.get("status")} onChange={(v) => p.set({ status: v })} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DateRange from={p.get("from")} to={p.get("to")} onChange={(from, to) => p.set({ from, to })} />
            <SearchBox value={p.get("q")} onChange={(q) => p.set({ q })} placeholder="Search ID, receipt, UTR, phone, email" />
          </div>
        </div>
        {error && (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        )}
        <DataTable
          columns={orderColumns}
          rows={data?.items}
          loading={loading}
          rowKey={(o) => o.id}
          onRowClick={(o) => nav(`/dashboard/orders/${o.id}`)}
          empty={
            filtered ? (
              <EmptyState icon={<Receipt className="size-5" />} title="No orders match these filters" action={<Button variant="outline" onClick={() => p.set({ status: "", q: "", from: "", to: "" })}>Clear filters</Button>} />
            ) : (
              <EmptyState
                icon={<Receipt className="size-5" />}
                title="No orders yet"
                description="Orders appear here when you create them with the API, a payment link or Quick Collect."
                action={can.write ? <Button onClick={() => setCreating(true)}>Create order</Button> : undefined}
              />
            )
          }
        />
        {data && <Pagination skip={p.skip} count={COUNT} shown={data.items.length} hasMore={data.has_more} onChange={(skip) => p.set({ skip })} />}
      </Card>
      <CreateOrderModal open={creating} onClose={() => setCreating(false)} onDone={(o) => nav(`/dashboard/orders/${o.id}`)} />
    </div>
  );
}
