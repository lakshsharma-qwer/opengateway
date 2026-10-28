import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./ui";
import { cx } from "../lib/format";

function useOverlayBehavior(open: boolean, onClose: () => void, panel: React.RefObject<HTMLDivElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first field right away (the panel is already in the DOM), but never steal
    // focus from something the user has already moved to inside the dialog.
    if (!panel.current?.contains(document.activeElement)) {
      const el = panel.current?.querySelector<HTMLElement>("[data-autofocus], [autofocus], input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([data-close]):not([disabled])");
      (el ?? panel.current)?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open, panel]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useOverlayBehavior(open, onClose, panel);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" style={{ animation: "overlay-in .15s ease-out" }} onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-pop outline-none sm:rounded-2xl",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
        )}
        style={{ animation: "modal-in .2s cubic-bezier(.2,.7,.2,1)" }}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm leading-6 text-ink-3">
                {description}
              </p>
            )}
          </div>
          <button data-close aria-label="Close" onClick={onClose} className="-mr-2 grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-paper hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        {children && <div className="overflow-y-auto px-6 pb-2">{children}</div>}
        {footer && <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlayBehavior(open, onClose, panel);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-ink/40" style={{ animation: "overlay-in .15s ease-out" }} onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx("absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-pop outline-none", width === "md" ? "max-w-md" : "max-w-2xl")}
        style={{ animation: "slide-in-right .25s cubic-bezier(.2,.7,.2,1)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
          </div>
          <button data-close aria-label="Close" onClick={onClose} className="-mr-2 grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-paper hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<unknown> | void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          {tone === "danger" && <AlertTriangle className="size-5 text-danger" />}
          {title}
        </span>
      }
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Keep it
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={busy} onClick={run}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
