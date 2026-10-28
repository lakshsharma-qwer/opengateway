import { Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  BadgeIndianRupee,
  BarChart3,
  BookOpen,
  Building2,
  ChevronDown,
  Code2,
  CreditCard,
  FileDown,
  Home,
  KeyRound,
  Link2,
  ListTree,
  LogOut,
  Menu,
  MessageSquareText,
  Palette,
  QrCode,
  Receipt,
  ScrollText,
  ShieldCheck,
  Undo2,
  Users,
  Webhook,
  X,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { useAuth } from "../lib/auth";
import { useMode } from "../lib/mode";
import { cx } from "../lib/format";
import { FullPageSpinner } from "../components/ui";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean };
const NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ to: "/dashboard", label: "Home", icon: Home, end: true }] },
  {
    group: "Transactions",
    items: [
      { to: "/dashboard/orders", label: "Orders", icon: Receipt },
      { to: "/dashboard/payments", label: "Payments", icon: CreditCard },
      { to: "/dashboard/refunds", label: "Refunds", icon: Undo2 },
    ],
  },
  {
    group: "Collect",
    items: [
      { to: "/dashboard/payment-links", label: "Payment Links", icon: Link2 },
      { to: "/dashboard/quick-collect", label: "Quick Collect", icon: QrCode },
    ],
  },
  {
    group: "Operations",
    items: [
      { to: "/dashboard/verification", label: "Verification", icon: MessageSquareText },
      { to: "/dashboard/reports", label: "Reports", icon: FileDown },
    ],
  },
  {
    group: "Developers",
    items: [
      { to: "/dashboard/developers/api-keys", label: "API Keys", icon: KeyRound },
      { to: "/dashboard/developers/webhooks", label: "Webhooks", icon: Webhook },
      { to: "/dashboard/developers/events", label: "Events", icon: ListTree },
      { to: "/dashboard/developers/logs", label: "API Logs", icon: ScrollText },
    ],
  },
  {
    group: "Settings",
    items: [
      { to: "/dashboard/settings/business", label: "Business profile", icon: Building2 },
      { to: "/dashboard/settings/upi", label: "UPI accounts", icon: BadgeIndianRupee },
      { to: "/dashboard/settings/checkout", label: "Checkout & branding", icon: Palette },
      { to: "/dashboard/settings/team", label: "Team", icon: Users },
      { to: "/dashboard/settings/security", label: "Security", icon: ShieldCheck },
    ],
  },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Dashboard" className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to="/dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pt-2 pb-6">
        {NAV.map((sec, i) => (
          <div key={i}>
            {sec.group && <div className="mb-1 px-3 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{sec.group}</div>}
            <ul className="space-y-0.5">
              {sec.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cx(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors",
                        isActive ? "bg-brand-600 text-white shadow-sm" : "text-ink-2 hover:bg-brand-50 hover:text-brand-800",
                      )
                    }
                  >
                    <it.icon className="size-[18px] shrink-0 opacity-90" />
                    {it.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3">
        <Link to="/docs" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-2 hover:bg-brand-50">
          <BookOpen className="size-[18px]" /> API docs
        </Link>
      </div>
    </nav>
  );
}

function ModeToggle() {
  const { mode, setMode } = useMode();
  return (
    <div role="radiogroup" aria-label="Data mode" className="flex rounded-full border border-line-2 bg-paper p-0.5 text-[12.5px] font-semibold">
      {(["test", "live"] as const).map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          onClick={() => setMode(m)}
          className={cx(
            "rounded-full px-3 py-1 transition-colors",
            mode === m ? (m === "test" ? "bg-marigold text-ink" : "bg-credit text-white") : "text-ink-3 hover:text-ink",
          )}
        >
          {m === "test" ? "Test" : "Live"}
        </button>
      ))}
    </div>
  );
}

function UserMenu() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open]);
  if (!me) return null;
  const initials = me.user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-paper">
        <span className="grid size-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{initials}</span>
        <span className="hidden max-w-36 truncate text-sm font-semibold text-ink md:block">{me.merchant.business_name}</span>
        <ChevronDown className="size-4 text-ink-3" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 animate-fade-up rounded-2xl border border-line bg-white p-2 shadow-pop">
          <div className="px-3 py-2">
            <div className="text-sm font-semibold text-ink">{me.user.name}</div>
            <div className="truncate text-xs text-ink-3">{me.user.email}</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-3">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700 capitalize">{me.user.role}</span>
              <span className="font-mono">{me.merchant.id}</span>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" to="/dashboard/settings/business" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-paper">
            <Building2 className="size-4" /> Business profile
          </Link>
          <Link role="menuitem" to="/dashboard/developers/api-keys" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-paper">
            <Code2 className="size-4" /> API keys
          </Link>
          <button
            role="menuitem"
            onClick={async () => {
              await logout();
              nav("/login");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout() {
  const { mode } = useMode();
  const { me } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);

  return (
    <div className="min-h-screen">
      {mode === "test" && (
        <div className="sticky top-0 z-40 flex h-7 items-center justify-center gap-2 bg-marigold text-[11.5px] font-bold tracking-[0.12em] text-ink uppercase">
          <span className="size-1.5 rounded-full bg-ink" /> Test mode
          <span className="hidden font-medium tracking-normal normal-case opacity-90 sm:inline">— you're viewing test data. No real money moves.</span>
        </div>
      )}
      <aside className={cx("fixed bottom-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block", mode === "test" ? "top-7" : "top-0")}>
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-pop" style={{ animation: "slide-in-left .22s ease-out" }}>
            <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 grid size-8 place-items-center rounded-lg hover:bg-paper">
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className={cx("sticky z-20 flex h-16 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur sm:px-6", mode === "test" ? "top-7" : "top-0")}>
          <button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-lg hover:bg-paper lg:hidden">
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </div>
          <div className="flex-1" />
          <Link to="/dashboard/quick-collect" className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 md:flex">
            <QrCode className="size-4" /> Quick collect
          </Link>
          <ModeToggle />
          <UserMenu />
        </header>

        {me && !me.merchant.onboarding_completed && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-800 sm:px-6">
            <span>
              <ArrowLeftRight className="mr-1.5 inline size-4" />
              Finish setting up: add your UPI ID and connect SMS verification.
            </span>
            <Link to="/onboarding" className="font-semibold underline underline-offset-4">
              Continue setup
            </Link>
          </div>
        )}
        {mode === "live" && me && !me.merchant.live_enabled && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-4 py-2.5 text-sm text-ink-2 sm:px-6">
            <span>
              <BarChart3 className="mr-1.5 inline size-4 text-credit" />
              Live mode isn't activated yet. Add a live UPI ID, then activate from Home.
            </span>
            <Link to="/dashboard/settings/upi" className="font-semibold text-brand-700 underline underline-offset-4">
              Add live UPI ID
            </Link>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<FullPageSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
