import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useDebounced } from "../lib/hooks";
import { dayEnd, dayStart } from "../lib/format";

/** Filter state kept in the URL so links like ?status=paid work and back/forward behave. */
export function useListParams(defaults: Record<string, string> = {}) {
  const [sp, setSp] = useSearchParams();
  const get = (k: string) => sp.get(k) ?? defaults[k] ?? "";
  const set = (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === defaults[k]) next.delete(k);
      else next.set(k, String(v));
    }
    if (!("skip" in patch)) next.delete("skip");
    setSp(next, { replace: true });
  };
  const from = dayStart(get("from"));
  const to = dayEnd(get("to"));
  return { get, set, skip: Number(get("skip") || 0), from, to };
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [text, setText] = useState(value);
  const deb = useDebounced(text, 350);
  useEffect(() => {
    if (deb !== value) onChange(deb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deb]);
  useEffect(() => setText(value), [value]);
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        aria-label={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-xl border border-line-2 bg-white pr-8 pl-9 text-sm placeholder:text-ink-3/70 hover:border-brand-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button aria-label="Clear search" onClick={() => setText("")} className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded text-ink-3 hover:text-ink">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const cls = "h-9 min-w-0 flex-1 sm:flex-none rounded-xl border border-line-2 bg-white px-2.5 text-sm text-ink-2 hover:border-brand-300 focus:border-brand-500 focus:outline-none";
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm text-ink-3">
      <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className={cls} />
      <span>–</span>
      <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className={cls} />
      {(from || to) && (
        <button onClick={() => onChange("", "")} className="ml-1 text-xs font-semibold text-brand-700 hover:underline">
          Clear
        </button>
      )}
    </div>
  );
}
