import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cx } from "../lib/format";

type Kind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: Kind;
  message: string;
}
interface ToastCtx {
  toast: (message: string, kind?: Kind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}
const Ctx = createContext<ToastCtx | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (message: string, kind: Kind = "info") => {
      const id = ++seq;
      setItems((xs) => [...xs.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
    },
    [dismiss],
  );
  const value = useMemo(
    () => ({ toast, success: (m: string) => toast(m, "success"), error: (m: string) => toast(m, "error") }),
    [toast],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
        {items.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertCircle : Info;
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-pop"
            >
              <Icon
                className={cx("mt-0.5 size-4 shrink-0", t.kind === "success" && "text-emerald-400", t.kind === "error" && "text-rose-400", t.kind === "info" && "text-brand-300")}
              />
              <p className="flex-1 leading-5">{t.message}</p>
              <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-white/60 hover:text-white">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast outside ToastProvider");
  return c;
}
