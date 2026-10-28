import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "./ui";
import { cx } from "../lib/format";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
  hideOnMobile?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  rowKey,
  onRowClick,
  empty,
  skeletonRows = 6,
}: {
  columns: Column<T>[];
  rows: T[] | null | undefined;
  loading?: boolean;
  rowKey: (r: T) => string;
  onRowClick?: (r: T) => void;
  empty?: ReactNode;
  skeletonRows?: number;
}) {
  const showSkeleton = loading && !rows?.length;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-paper/60">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx(
                  "px-4 py-2.5 text-[11.5px] font-semibold tracking-wide whitespace-nowrap text-ink-3 uppercase first:pl-5 last:pr-5",
                  c.align === "right" && "text-right",
                  c.hideOnMobile && "hidden md:table-cell",
                  c.key === "actions" && "sticky right-0 bg-[#fbfafd]",
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cx(loading && rows?.length ? "opacity-60 transition-opacity" : "")}>
          {showSkeleton &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className={cx("px-4 py-3.5 first:pl-5 last:pr-5", c.hideOnMobile && "hidden md:table-cell")}>
                    <Skeleton className={i % 2 ? "w-20" : "w-28"} />
                  </td>
                ))}
              </tr>
            ))}
          {!showSkeleton &&
            rows?.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={
                  onRowClick
                    ? (e) => {
                        // Buttons, links and inputs inside a row do their own thing; don't also "open" the row.
                        const t = e.target as HTMLElement;
                        if (t.closest("button, a, input, select, textarea, label") && t.closest("tr") === e.currentTarget) return;
                        onRowClick(r);
                      }
                    : undefined
                }
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(r);
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cx(
                  "border-b border-line transition-colors last:border-0",
                  onRowClick && "cursor-pointer hover:bg-brand-50/50 focus-visible:bg-brand-50/60",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      "px-4 py-3 align-middle whitespace-nowrap first:pl-5 last:pr-5",
                      c.align === "right" && "text-right",
                      c.hideOnMobile && "hidden md:table-cell",
                      c.key === "actions" && "sticky right-0 bg-white/95 shadow-[-12px_0_12px_-12px_rgb(28_16_41/0.12)] backdrop-blur-sm",
                      c.className,
                    )}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {!loading && rows && rows.length === 0 && empty}
    </div>
  );
}

export function Pagination({
  skip,
  count,
  shown,
  hasMore,
  onChange,
}: {
  skip: number;
  count: number;
  shown: number;
  hasMore: boolean;
  onChange: (skip: number) => void;
}) {
  if (skip === 0 && !hasMore) return shown ? <div className="border-t border-line px-5 py-3 text-xs text-ink-3">{shown} {shown === 1 ? "result" : "results"}</div> : null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink-3">
      <span className="tabular">
        Showing {shown ? skip + 1 : 0}–{skip + shown}
      </span>
      <div className="flex gap-1">
        <button
          aria-label="Previous page"
          disabled={skip === 0}
          onClick={() => onChange(Math.max(0, skip - count))}
          className="grid size-8 place-items-center rounded-lg border border-line-2 bg-white text-ink-2 hover:border-brand-300 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          aria-label="Next page"
          disabled={!hasMore}
          onClick={() => onChange(skip + count)}
          className="grid size-8 place-items-center rounded-lg border border-line-2 bg-white text-ink-2 hover:border-brand-300 disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
