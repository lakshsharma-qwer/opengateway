import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { useFetch } from "../../../lib/hooks";
import { itemsOf } from "../../../lib/api";
import type { ApiLog, Collection } from "../../../lib/types";
import { cx, fmtDate } from "../../../lib/format";
import { Button, Card, Chips, EmptyState, ErrorBanner, Mono, PageHeader } from "../../../components/ui";
import { DataTable } from "../../../components/DataTable";

type F = "all" | "2xx" | "4xx" | "5xx";
const PAGE = 50;

export default function ApiLogs() {
  const { data, loading, error, reload } = useFetch<Collection<ApiLog> | ApiLog[]>("/api/api-logs");
  const [f, setF] = useState<F>("all");
  const [page, setPage] = useState(1);
  const rows = useMemo(() => {
    const all = itemsOf(data);
    return f === "all" ? all : all.filter((r) => String(r.status).startsWith(f[0]));
  }, [data, f]);
  return (
    <div>
      <PageHeader title="API logs" subtitle="The last 500 requests made to /v1 with your keys." actions={<Button variant="outline" onClick={reload}>Refresh</Button>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <Card>
        <div className="border-b border-line p-4">
          <Chips<F>
            options={[
              { value: "all", label: "All" },
              { value: "2xx", label: "2xx" },
              { value: "4xx", label: "4xx" },
              { value: "5xx", label: "5xx" },
            ]}
            value={f}
            onChange={(v) => {
              setF(v);
              setPage(1);
            }}
          />
        </div>
        <DataTable
          columns={[
            { key: "at", header: "Time", cell: (r) => <span className="text-ink-2">{fmtDate(r.created_at)}</span> },
            { key: "method", header: "Method", cell: (r) => <span className="font-mono text-xs font-semibold text-brand-700">{r.method}</span> },
            { key: "path", header: "Path", cell: (r) => <Mono>{r.path}</Mono> },
            {
              key: "status",
              header: "Status",
              cell: (r) => (
                <span className={cx("rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold", r.status < 300 ? "bg-credit-soft text-credit" : r.status < 500 ? "bg-marigold-soft text-[#9a4d00]" : "bg-danger-soft text-danger")}>
                  {r.status}
                </span>
              ),
            },
            { key: "dur", header: "Duration", align: "right", cell: (r) => <span className="tabular text-ink-2">{r.duration_ms} ms</span> },
            { key: "key", header: "Key", hideOnMobile: true, cell: (r) => <Mono className="text-xs">{r.key_id ?? "—"}</Mono> },
          ]}
          rows={rows.slice(0, page * PAGE)}
          loading={loading}
          rowKey={(r) => r.id}
          empty={<EmptyState icon={<ScrollText className="size-5" />} title="No API requests yet" description="Calls to /v1 using your API keys will be listed here." />}
        />
        {rows.length > page * PAGE && (
          <div className="border-t border-line p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)}>
              Show more
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
