import { useState } from "react";
import { CreditCard, Download, FileSpreadsheet, Receipt, Undo2 } from "lucide-react";
import { downloadFile, errorMessage } from "../../lib/api";
import { useMode } from "../../lib/mode";
import { cx, dayEnd, dayStart, isoDay } from "../../lib/format";
import { Button, Card, Chips, PageHeader } from "../../components/ui";
import { DateRange } from "../../components/Filters";
import { useToast } from "../../components/Toast";

type Type = "orders" | "payments" | "refunds";
const TYPES: { value: Type; label: string; desc: string; icon: typeof Receipt }[] = [
  { value: "orders", label: "Orders", desc: "Every order with amount, status, receipt, customer and UTR.", icon: Receipt },
  { value: "payments", label: "Payments", desc: "Each payment attempt, its UPI app, UTR and who verified it.", icon: CreditCard },
  { value: "refunds", label: "Refunds", desc: "Refunds you've recorded and their processing UTRs.", icon: Undo2 },
];
type Preset = "today" | "7d" | "30d" | "month" | "custom";
const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
];

function rangeFor(p: Preset): [string, string] {
  const now = new Date();
  const today = isoDay(now);
  if (p === "today") return [today, today];
  if (p === "7d") return [isoDay(new Date(now.getTime() - 6 * 86400000)), today];
  if (p === "30d") return [isoDay(new Date(now.getTime() - 29 * 86400000)), today];
  if (p === "month") return [isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), today];
  return ["", ""];
}

interface Recent {
  type: Type;
  from: string;
  to: string;
  at: number;
  mode: string;
}

export default function Reports() {
  const toast = useToast();
  const { mode } = useMode();
  const [type, setType] = useState<Type>("orders");
  const [preset, setPreset] = useState<Preset>("30d");
  const [[from, to], setRange] = useState<[string, string]>(rangeFor("30d"));
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);

  const download = async (t = type, f = from, tt = to) => {
    setBusy(true);
    try {
      await downloadFile("/api/reports/export", { type: t, from: dayStart(f), to: dayEnd(tt) }, `opengateway-${mode}-${t}-${f || "all"}-${tt || "now"}.csv`);
      setRecent((r) => [{ type: t, from: f, to: tt, at: Date.now(), mode }, ...r].slice(0, 6));
      toast.success("Report downloaded");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle={`Download ${mode} data as CSV for reconciliation and accounting.`} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="min-w-0 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-ink-2">Report type</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup">
            {TYPES.map((t) => (
              <button
                key={t.value}
                role="radio"
                aria-checked={type === t.value}
                onClick={() => setType(t.value)}
                className={cx("rounded-2xl border p-4 text-left transition-colors", type === t.value ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-line-2 hover:border-brand-300")}
              >
                <t.icon className={cx("size-5", type === t.value ? "text-brand-600" : "text-ink-3")} />
                <div className="mt-2 font-semibold">{t.label}</div>
                <div className="mt-0.5 text-xs leading-5 text-ink-3">{t.desc}</div>
              </button>
            ))}
          </div>

          <h2 className="mt-7 text-sm font-semibold text-ink-2">Duration</h2>
          <div className="mt-3">
            <Chips
              options={PRESETS}
              value={preset}
              onChange={(p) => {
                setPreset(p);
                if (p !== "custom") setRange(rangeFor(p));
              }}
            />
          </div>
          <div className="mt-3">
            <DateRange
              from={from}
              to={to}
              onChange={(f, t) => {
                setPreset("custom");
                setRange([f, t]);
              }}
            />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-xs text-ink-3">Times are in your local timezone. Recent payments may take a few seconds to appear.</p>
            <Button icon={<Download className="size-4" />} onClick={() => download()} loading={busy}>
              Download CSV
            </Button>
          </div>
        </Card>

        <Card>
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-[15px] font-semibold">Downloaded this session</h3>
          </div>
          {recent.length ? (
            <ul className="divide-y divide-line">
              {recent.map((r) => (
                <li key={r.at} className="flex items-center gap-3 px-5 py-3">
                  <FileSpreadsheet className="size-5 text-credit" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold capitalize">
                      {r.type} <span className="font-normal text-ink-3">· {r.mode}</span>
                    </div>
                    <div className="text-xs text-ink-3">
                      {r.from || "Beginning"} → {r.to || "Now"}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" aria-label="Download again" onClick={() => download(r.type, r.from, r.to)}>
                    <Download className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-ink-3">Reports you download appear here for quick re-download.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
