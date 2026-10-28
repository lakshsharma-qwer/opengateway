import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { cx } from "../lib/format";

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "dark";
type Size = "sm" | "md" | "lg";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-[inset_0_-1px_0_rgb(0_0_0/0.15)]",
  secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100",
  outline: "bg-white text-ink border border-line-2 hover:border-brand-300 hover:bg-brand-50/40",
  ghost: "text-ink-2 hover:bg-brand-50 hover:text-brand-700",
  danger: "bg-danger text-white hover:bg-[#ad2630]",
  dark: "bg-ink text-white hover:bg-black",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
};
/** Button styling for links that look like buttons (never nest a <button> inside a link). */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

/* ---------- Field wrapper ---------- */
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
  optional,
  messageId,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
  optional?: boolean;
  /** id for the hint/error line, so the control can reference it with aria-describedby */
  messageId?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">
          {label}
          {optional && <span className="ml-1 font-normal text-ink-3">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={messageId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-line-2 bg-white px-3.5 text-sm text-ink placeholder:text-ink-3/70 transition-colors hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/12 disabled:bg-paper disabled:text-ink-3";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  optional?: boolean;
  wrapClassName?: string;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, className, id, optional, wrapClassName, ...rest },
  ref,
) {
  const auto = useId();
  const iid = id ?? auto;
  const msgId = `${iid}-msg`;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={iid} optional={optional} className={wrapClassName} messageId={msgId}>
      <div className="relative">
        {leading && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-3">{leading}</span>}
        <input
          ref={ref}
          id={iid}
          aria-invalid={!!error || undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className={cx(inputBase, "h-10", leading ? "pl-9" : "", trailing ? "pr-10" : "", error && "border-danger", className)}
          {...rest}
        />
        {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
      </div>
    </Field>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
}
export function Textarea({ label, hint, error, className, id, optional, ...rest }: TextareaProps) {
  const auto = useId();
  const iid = id ?? auto;
  const msgId = `${iid}-msg`;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={iid} optional={optional} messageId={msgId}>
      <textarea id={iid} aria-invalid={!!error || undefined} aria-describedby={error || hint ? msgId : undefined} className={cx(inputBase, "min-h-24 py-2.5 leading-6", className)} {...rest} />
    </Field>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  options: { value: string; label: string }[];
  wrapClassName?: string;
}
export function Select({ label, hint, options, className, id, wrapClassName, ...rest }: SelectProps) {
  const auto = useId();
  const iid = id ?? auto;
  const msgId = `${iid}-msg`;
  return (
    <Field label={label} hint={hint} htmlFor={iid} className={wrapClassName} messageId={msgId}>
      <select
        id={iid}
        aria-describedby={hint ? msgId : undefined}
        className={cx(
          inputBase,
          "h-10 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9",
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a7086' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
          className,
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/* ---------- Switch ---------- */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-brand-600" : "bg-line-2",
        )}
      >
        <span className={cx("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
      </button>
      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer">
          {label && <span className="block text-sm font-semibold text-ink">{label}</span>}
          {description && <span className="block text-xs leading-5 text-ink-3">{description}</span>}
        </label>
      )}
    </div>
  );
}

/* ---------- Card ---------- */
export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-line bg-white shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}
export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */
type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-[#f0edf4] text-ink-2",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-credit-soft text-credit",
  warning: "bg-marigold-soft text-[#9a4d00]",
  danger: "bg-danger-soft text-danger",
  info: "bg-sky-50 text-sky-700",
};
export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  paid: "success",
  captured: "success",
  processed: "success",
  success: "success",
  matched: "success",
  active: "success",
  created: "neutral",
  attempted: "info",
  pending: "warning",
  pending_verification: "warning",
  unmatched: "warning",
  expired: "neutral",
  cancelled: "neutral",
  ignored: "neutral",
  duplicate: "neutral",
  revoked: "neutral",
  failed: "danger",
  inactive: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  pending_verification: "Verifying",
  attempted: "Attempted",
};
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-ink-3">—</span>;
  const label = STATUS_LABEL[status] ?? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} dot>
      {label}
    </Badge>
  );
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cx("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cx(
            "relative -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors",
            t.value === value ? "border-brand-600 text-brand-700" : "border-transparent text-ink-3 hover:text-ink",
          )}
        >
          {t.label}
          {t.count != null && <span className="rounded-full bg-brand-50 px-1.5 text-[11px] text-brand-700">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Chips (filter pills) ---------- */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-8 rounded-full border px-3 text-[13px] font-semibold transition-colors",
            o.value === value ? "border-brand-600 bg-brand-600 text-white" : "border-line-2 bg-white text-ink-2 hover:border-brand-300",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>}
      <h4 className="text-base font-semibold text-ink">{title}</h4>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-ink-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton h-4", className)} aria-hidden />;
}

/* ---------- CopyButton ---------- */
export function CopyButton({ value, label, className, size = "icon" }: { value: string; label?: string; className?: string; size?: "icon" | "sm" }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const t = document.createElement("textarea");
      t.value = value;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  if (size === "sm" || label) {
    return (
      <Button variant="outline" size="sm" onClick={copy} className={className} icon={copied ? <Check className="size-3.5 text-credit" /> : <Copy className="size-3.5" />}>
        {copied ? "Copied" : label ?? "Copy"}
      </Button>
    );
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      title={copied ? "Copied" : "Copy"}
      className={cx("inline-grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-brand-50 hover:text-brand-700", className)}
    >
      {copied ? <Check className="size-3.5 text-credit" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/* ---------- Mono ID ---------- */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono text-[12.5px] text-ink-2", className)}>{children}</span>;
}
export function IdCell({ id, className }: { id: string | null | undefined; className?: string }) {
  if (!id) return <span className="text-ink-3">—</span>;
  return (
    <span className={cx("inline-flex items-center gap-0.5", className)}>
      <Mono>{id}</Mono>
      <CopyButton value={id} />
    </span>
  );
}

/* ---------- Secret box ---------- */
export function SecretBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <div className="mb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 font-mono text-[13px] break-all text-ink">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

/* ---------- Definition list ---------- */
export function DL({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium text-ink-3">{k}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-[60vh] place-items-center" aria-busy="true">
      <Loader2 className="size-6 animate-spin text-brand-600" aria-label="Loading" />
    </div>
  );
}
