import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, HelpCircle, Sparkles } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import type { ParsedSms } from "../lib/types";
import { formatINR } from "../lib/money";
import { Button, CopyButton, Textarea } from "./ui";
import { cx } from "../lib/format";

export const SAMPLE_SMS = [
  { bank: "HDFC", text: "Rs.499.01 credited to a/c XX4421 on 23-10-26 by a/c linked to VPA priya.s@okaxis (UPI Ref No 412345678901). Avl Bal Rs.12,040.50 -HDFC Bank" },
  { bank: "SBI", text: "Dear UPI user A/C X5678 credited by Rs1250.00 on 23Oct26 by (Ref no 430912345678) from rahul@ybl. -SBI" },
  { bank: "ICICI", text: "ICICI Bank Acct XX902 credited with INR 2,000.00 on 23-Oct-26; UPI:431122334455 from amit@paytm. Available Bal INR 54,210.00" },
  { bank: "PhonePe", text: "Received ₹350 from Neha Kapoor (neha@ybl) in your account. UPI Txn ID 432198765432" },
];

/** Paste a bank SMS and see what the parser extracts. Uses POST /api/observers/test-parse. */
export function SmsPlayground({ compact }: { compact?: boolean }) {
  const [text, setText] = useState(SAMPLE_SMS[0].text);
  const [result, setResult] = useState<ParsedSms | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api.post<ParsedSms | { parsed: ParsedSms }>("/api/observers/test-parse", { text });
      setResult("parsed" in r && r.parsed ? r.parsed : (r as ParsedSms));
    } catch (e) {
      setError(errorMessage(e));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cx("grid gap-5", !compact && "lg:grid-cols-2")}>
      <div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SAMPLE_SMS.map((s) => (
            <button
              key={s.bank}
              onClick={() => {
                setText(s.text);
                setResult(null);
              }}
              className="rounded-full border border-line-2 bg-white px-2.5 py-1 text-xs font-semibold text-ink-2 hover:border-brand-300"
            >
              {s.bank} sample
            </button>
          ))}
        </div>
        <Textarea label="SMS or notification text" value={text} onChange={(e) => setText(e.target.value)} rows={4} className="font-mono text-[13px]" />
        <Button className="mt-3" icon={<Sparkles className="size-4" />} onClick={run} loading={busy} disabled={!text.trim()}>
          Parse message
        </Button>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
      <div className="rounded-2xl border border-dashed border-line-2 bg-paper/60 p-4">
        <div className="mb-3 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">What we extract</div>
        {result ? (
          <dl className="space-y-2.5 text-sm">
            <Row label="Direction">
              <span className={cx("inline-flex items-center gap-1 font-semibold", result.direction === "credit" ? "text-credit" : result.direction === "debit" ? "text-danger" : "text-ink-3")}>
                {result.direction === "credit" ? <ArrowDownLeft className="size-4" /> : result.direction === "debit" ? <ArrowUpRight className="size-4" /> : <HelpCircle className="size-4" />}
                {result.direction}
              </span>
            </Row>
            <Row label="Amount">{result.amount != null ? <b className="tabular">{formatINR(result.amount)}</b> : <span className="text-ink-3">not found</span>}</Row>
            <Row label="UTR">{result.utr ? <span className="font-mono">{result.utr}</span> : <span className="text-ink-3">not found</span>}</Row>
            <Row label="Payer VPA">{result.payer_vpa ? <span className="font-mono">{result.payer_vpa}</span> : <span className="text-ink-3">not found</span>}</Row>
            <p className="pt-2 text-xs leading-5 text-ink-3">
              {result.direction === "credit" && result.amount != null
                ? "A credit like this will be matched to an open order with exactly this payable amount, or by UTR."
                : "This message would be ignored: only credits with an amount are matched."}
            </p>
          </dl>
        ) : (
          <p className="text-sm text-ink-3">Pick a sample or paste one of your own bank messages, then parse it.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** Setup steps for SMS forwarder apps. */
export function ForwarderInstructions({ ingestUrl }: { ingestUrl: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-paper p-4">
        <div className="mb-1 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">Your ingest URL</div>
        <div className="flex items-start gap-2">
          <code className="min-w-0 flex-1 font-mono text-[12.5px] leading-5 break-all text-ink">{ingestUrl}</code>
          <CopyButton value={ingestUrl} />
        </div>
        <p className="mt-2 text-xs text-ink-3">Keep this private — the token in it lets anyone post messages to your account.</p>
      </div>
      <ol className="space-y-3 text-sm text-ink-2">
        {[
          <>On the Android phone that gets your bank's SMS, install any <b>SMS forwarder</b> app that can forward to a webhook URL.</>,
          <>Add a rule that forwards messages from your bank's sender (e.g. <span className="font-mono text-xs">HDFCBK</span>, <span className="font-mono text-xs">SBIUPI</span>) — or all messages containing "credited".</>,
          <>Set the destination to <b>Webhook / HTTP POST</b> and paste the ingest URL above. JSON, form or plain-text bodies all work; the message text can be in <span className="font-mono text-xs">text</span>, <span className="font-mono text-xs">message</span>, <span className="font-mono text-xs">msg</span>, <span className="font-mono text-xs">body</span> or <span className="font-mono text-xs">sms</span>.</>,
          <>Send yourself ₹1 from another UPI app and check that "Last seen" updates on the Verification page.</>,
        ].map((c, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
            <span className="leading-6">{c}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
