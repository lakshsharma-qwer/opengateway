import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Undo2 } from "lucide-react";
import { useFetch } from "../../lib/hooks";
import { api, errorMessage } from "../../lib/api";
import { useCan } from "../../lib/auth";
import type { Collection, Refund } from "../../lib/types";
import { Button, Card, Chips, EmptyState, ErrorBanner, PageHeader } from "../../components/ui";
import { DataTable, Pagination, type Column } from "../../components/DataTable";
import { refundColumns } from "../../components/columns";
import { useListParams } from "../../components/Filters";
import { ProcessRefundModal, RefundModal } from "../../components/Actions";
import { ConfirmModal } from "../../components/Overlay";
import { useToast } from "../../components/Toast";

const COUNT = 25;
const STATUSES = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processed", label: "Processed" },
  { value: "failed", label: "Failed" },
];

export default function Refunds() {
  const toast = useToast();
  const can = useCan();
  const p = useListParams();
  const [creating, setCreating] = useState(false);
  const [processing, setProcessing] = useState<Refund | null>(null);
  const [failing, setFailing] = useState<Refund | null>(null);
  const { data, loading, error, reload } = useFetch<Collection<Refund>>("/api/refunds", { status: p.get("status"), count: COUNT, skip: p.skip });

  const columns: Column<Refund>[] = [
    ...refundColumns.slice(0, 3),
    {
      key: "order",
      header: "Order",
      hideOnMobile: true,
      cell: (r) => (
        <Link to={`/dashboard/orders/${r.order_id}`} className="font-mono text-[12.5px] text-brand-700 hover:underline">
          {r.order_id}
        </Link>
      ),
    },
    ...refundColumns.slice(3),
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) =>
        can.refunds && r.status === "pending" ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setFailing(r)}>
              Mark failed
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setProcessing(r)}>
              Mark processed
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Refunds"
        subtitle="Refunds are sent from your own UPI app. Record them here so your books and webhooks stay in sync."
        actions={
          can.refunds && (
            <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Create refund
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
          rowKey={(r) => r.id}
          empty={<EmptyState icon={<Undo2 className="size-5" />} title="No refunds" description="Issue a refund from a paid order, or create one with a payment ID." />}
        />
        {data && <Pagination skip={p.skip} count={COUNT} shown={data.items.length} hasMore={data.has_more} onChange={(skip) => p.set({ skip })} />}
      </Card>
      <RefundModal open={creating} onClose={() => setCreating(false)} onDone={reload} />
      <ProcessRefundModal refund={processing} open={!!processing} onClose={() => setProcessing(null)} onDone={reload} />
      <ConfirmModal
        open={!!failing}
        onClose={() => setFailing(null)}
        title="Mark refund as failed?"
        description="Use this if the money couldn't be sent back. The amount becomes refundable again."
        confirmLabel="Mark failed"
        onConfirm={async () => {
          if (!failing) return;
          try {
            await api.post(`/api/refunds/${failing.id}/fail`);
            toast.success("Refund marked failed");
            setFailing(null);
            reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}
