import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BadgeCheck, Clock, Hourglass, IndianRupee, Inbox, Receipt, Rocket, ShieldQuestion, Target } from "lucide-react";
import { useFetch } from "../../lib/hooks";
import { api, errorMessage } from "../../lib/api";
import { useAuth, useCan } from "../../lib/auth";
import { useMode } from "../../lib/mode";
import type { Summary } from "../../lib/types";
import { formatINR } from "../../lib/money";
import { cx, UPI_APP_LABEL } from "../../lib/format";
import { Button, buttonClass, Card, CardHeader, Chips, EmptyState, ErrorBanner, PageHeader, Skeleton } from "../../components/ui";
import { DataTable } from "../../components/DataTable";
import { orderColumns } from "../../components/columns";
import { useToast } from "../../components/Toast";

type Range = "today" | "7d" | "30d" | "90d";
const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];
const DONUT = ["#5f259f", "#8b5ecb", "#f08a1c", "#0b8a5f", "#b394e0", "#7a7086"];

export default function Home() {
  const [range, setRange] = useState<Range>("7d");
  const { data, loading, error, reload } = useFetch<Summary>("/api/dashboard/summary", { range });
  const { me } = useAuth();
  const can = useCan();
  const nav = useNavigate();

  const kpis = [
    { label: "Collected", value: data ? formatINR(data.collected_amount) : null, icon: IndianRupee, accent: true },
    { label: "Orders", value: data ? `${data.paid_count.toLocaleString("en-IN")} paid / ${data.orders_count.toLocaleString("en-IN")}` : null, icon: Receipt },
    { label: "Success rate", value: data ? `${(data.success_rate ?? 0).toFixed(1)}%` : null, icon: Target },
    { label: "Avg. ticket", value: data ? formatINR(data.avg_ticket) : null, icon: BadgeCheck },
    { label: "Pending verification", value: data ? String(data.pending_verification_count) : null, icon: Hourglass, to: "/dashboard/payments?status=pending_verification", warn: (data?.pending_verification_count ?? 0) > 0 },
    { label: "Unmatched credits", value: data ? String(data.unmatched_observations_count) : null, icon: ShieldQuestion, to: "/dashboard/verification", warn: (data?.unmatched_observations_count ?? 0) > 0 },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${me?.user.name.split(" ")[0] ?? ""}`}
        subtitle="Here's how your UPI collections are doing."
        actions={<Chips options={RANGES} value={range} onChange={setRange} />}
      />

      {error && <ErrorBanner message={error} onRetry={reload} />}

      {me && !me.merchant.live_enabled && can.team && <ActivateLive />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <span className={cx("text-[12.5px] font-semibold", k.accent ? "text-brand-100" : "text-ink-3")}>{k.label}</span>
                <k.icon className={cx("size-4", k.accent ? "text-brand-200" : k.warn ? "text-marigold" : "text-ink-3")} />
              </div>
              {k.value == null ? (
                <Skeleton className="mt-3 h-7 w-24" />
              ) : (
                <div className={cx("mt-2 font-display text-[22px] leading-tight font-semibold tabular", k.accent ? "text-white" : "text-ink", k.label === "Orders" && "text-lg")}>{k.value}</div>
              )}
            </>
          );
          const cls = cx(
            "rounded-2xl border p-4 transition-colors",
            k.accent ? "border-brand-700 bg-brand-600" : "border-line bg-white shadow-card",
            k.to && "hover:border-brand-300",
            k.warn && "border-marigold/40",
          );
          return k.to ? (
            <Link key={k.label} to={k.to} className={cls}>
              {inner}
            </Link>
          ) : (
            <div key={k.label} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Collections" subtitle="Paid amount by day" />
          <div className="h-72 px-2 pt-4 pb-2">
            {loading && !data ? (
              <Skeleton className="mx-4 h-60" />
            ) : data && data.series.some((s) => s.amount > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="og-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5f259f" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#5f259f" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#ede8f3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#6b6178" }}
                    tickFormatter={(d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    minTickGap={24}
                  />
                  <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: "#6b6178" }} tickFormatter={(v: number) => formatINR(v, { compact: true })} />
                  <Tooltip
                    cursor={{ stroke: "#b394e0", strokeDasharray: "3 3" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e7e1ef", boxShadow: "0 8px 24px -8px rgb(42 13 79 / .2)", fontSize: 12 }}
                    labelFormatter={(d) => new Date(`${String(d)}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    formatter={(v, name) => (name === "amount" ? [formatINR(Number(v)), "Collected"] : [String(v), "Payments"])}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#5f259f" strokeWidth={2.2} fill="url(#og-area)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<Clock className="size-5" />} title="No collections in this period" description="Paid orders will chart here. Try Quick Collect to take your first payment." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="UPI app split" subtitle="Paid orders by app" />
          <div className="p-5">
            {loading && !data ? (
              <Skeleton className="mx-auto size-40 rounded-full" />
            ) : data && data.method_split.length ? (
              <>
                <div className="relative mx-auto h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.method_split} dataKey="count" nameKey="upi_app" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                        {data.method_split.map((_, i) => (
                          <Cell key={i} fill={DONUT[i % DONUT.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <div className="font-display text-2xl font-semibold tabular">{data.method_split.reduce((a, b) => a + b.count, 0)}</div>
                      <div className="text-[11px] text-ink-3">payments</div>
                    </div>
                  </div>
                </div>
                <ul className="mt-5 space-y-2 text-sm">
                  {data.method_split.map((m, i) => (
                    <li key={`${m.upi_app}-${i}`} className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />
                      <span className="flex-1 text-ink-2">{m.upi_app ? UPI_APP_LABEL[m.upi_app] ?? m.upi_app : "Scanned QR"}</span>
                      <span className="text-ink-3 tabular">{m.count}</span>
                      <span className="w-24 text-right font-semibold tabular">{formatINR(m.amount, { compact: true })}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState icon={<Inbox className="size-5" />} title="No payments yet" className="py-10" />
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Recent orders"
          action={
            <Link to="/dashboard/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          }
        />
        <DataTable
          columns={orderColumns}
          rows={data?.recent_orders}
          loading={loading}
          rowKey={(o) => o.id}
          onRowClick={(o) => nav(`/dashboard/orders/${o.id}`)}
          skeletonRows={5}
          empty={
            <EmptyState
              icon={<Receipt className="size-5" />}
              title="No orders yet"
              description="Create an order from your server with the API, or collect at the counter."
              action={
                <Link to="/dashboard/quick-collect" className={buttonClass()}>
                  Open Quick Collect
                </Link>
              }
            />
          }
        />
      </Card>
    </div>
  );
}

function ActivateLive() {
  const { refresh } = useAuth();
  const { setMode } = useMode();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const activate = async () => {
    setBusy(true);
    try {
      await api.post("/api/live/enable", {}, { mode: "live" });
      await refresh();
      setMode("live");
      toast.success("Live mode activated");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-5 flex flex-col gap-4 overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-5 sm:flex-row sm:items-center">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
        <Rocket className="size-5" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-ink">Activate live mode</h3>
        <p className="mt-0.5 text-sm leading-6 text-ink-2">
          Switch to <b>Live</b>, add the UPI ID real customers will pay, and make sure your business details are filled in. Then activate to accept real payments.
        </p>
      </div>
      <div className="flex gap-2">
        <Link to="/dashboard/settings/upi" onClick={() => setMode("live")} className={buttonClass("outline")}>
          Add live UPI ID
        </Link>
        <Button onClick={activate} loading={busy}>
          Activate
        </Button>
      </div>
    </div>
  );
}
