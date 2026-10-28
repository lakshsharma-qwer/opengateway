import { useNavigate } from "react-router-dom";
import { CreditCard, Download } from "lucide-react";
import { useState } from "react";
import { useFetch } from "../../lib/hooks";
import { downloadFile, errorMessage } from "../../lib/api";
import type { Collection, Payment } from "../../lib/types";
import { Button, Card, Chips, EmptyState, ErrorBanner, PageHeader } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { paymentColumns } from "../../components/columns";
import { DateRange, SearchBox, useListParams } from "../../components/Filters";
import { useToast } from "../../components/Toast";

const COUNT = 25;
const STATUSES = [
  { value: "", label: "All" },
  { value: "captured", label: "Captured" },
  { value: "pending_verification", label: "Verifying" },
  { value: "created", label: "Created" },
  { value: "failed", label: "Failed" },
];

export default function Payments() {
  const nav = useNavigate();
  const toast = useToast();
  const p = useListParams();
  const [exporting, setExporting] = useState(false);
  const { data, loading, error, reload } = useFetch<Collection<Payment>>("/api/payments", {
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
      await downloadFile("/api/reports/export", { type: "payments", from: p.from, to: p.to }, "payments.csv");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };
  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Every attempt customers made, including ones waiting for verification."
        actions={
          <Button variant="outline" icon={<Download className="size-4" />} onClick={exportCsv} loading={exporting}>
            Export
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <Chips options={STATUSES} value={p.get("status")} onChange={(v) => p.set({ status: v })} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DateRange from={p.get("from")} to={p.get("to")} onChange={(from, to) => p.set({ from, to })} />
            <SearchBox value={p.get("q")} onChange={(q) => p.set({ q })} placeholder="Search payment ID, order ID, UTR" />
          </div>
        </div>
        {error && (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={reload} />
          </div>
        )}
        <DataTable
          columns={paymentColumns}
          rows={data?.items}
          loading={loading}
          rowKey={(x) => x.id}
          onRowClick={(x) => nav(`/dashboard/orders/${x.order_id}`)}
          empty={<EmptyState icon={<CreditCard className="size-5" />} title={p.get("status") || p.get("q") ? "No payments match these filters" : "No payments yet"} description="A payment is recorded when a customer starts paying on checkout." />}
        />
        {data && <Pagination skip={p.skip} count={COUNT} shown={data.items.length} hasMore={data.has_more} onChange={(skip) => p.set({ skip })} />}
      </Card>
    </div>
  );
}
