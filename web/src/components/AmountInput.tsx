import { useEffect, useId, useState } from "react";
import { Field } from "./ui";
import { paiseToRupeesString, rupeesToPaise } from "../lib/money";
import { cx } from "../lib/format";

/** Takes rupees from the user, reports integer paise (or null) to the parent. */
export function AmountInput({
  value,
  onChange,
  label = "Amount",
  hint,
  error,
  size = "md",
  autoFocus,
  max,
  id,
}: {
  value: number | null;
  onChange: (paise: number | null) => void;
  label?: string;
  hint?: string;
  error?: string | null;
  size?: "md" | "xl";
  autoFocus?: boolean;
  max?: number;
  id?: string;
}) {
  const auto = useId();
  const iid = id ?? auto;
  const [text, setText] = useState(() => paiseToRupeesString(value));
  useEffect(() => {
    // Keep in sync when the parent resets the value.
    if (rupeesToPaise(text) !== value) setText(paiseToRupeesString(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const tooBig = max != null && value != null && value > max;
  const msg = error ?? (tooBig ? `Maximum is ₹${paiseToRupeesString(max)}` : null);
  const msgId = `${iid}-msg`;
  return (
    <Field label={label} hint={hint} error={msg} htmlFor={iid} messageId={msgId}>
      <div className="relative">
        <span className={cx("pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-display font-semibold text-ink-3", size === "xl" ? "text-3xl" : "text-sm")}>₹</span>
        <input
          id={iid}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={msg ? true : undefined}
          aria-describedby={msg || hint ? msgId : undefined}
          placeholder="0.00"
          value={text}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.,]/g, "");
            setText(raw);
            onChange(rupeesToPaise(raw));
          }}
          className={cx(
            "tabular w-full rounded-xl border border-line-2 bg-white text-ink transition-colors hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12 focus:outline-none",
            size === "xl" ? "h-20 pl-10 font-display text-4xl font-semibold" : "h-10 pl-8 text-sm",
            (error || tooBig) && "border-danger",
          )}
        />
      </div>
    </Field>
  );
}
