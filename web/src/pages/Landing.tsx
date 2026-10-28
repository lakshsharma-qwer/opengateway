import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeIndianRupee,
  Bell,
  Check,
  ChevronDown,
  Clock3,
  FileDown,
  FlaskConical,
  Link2,
  Lock,
  MessageSquareText,
  QrCode,
  ShieldCheck,
  Smartphone,
  Users,
  Webhook,
} from "lucide-react";
import { AppBadge, Logo, LogoMark } from "../components/Logo";
import { QR } from "../components/QR";
import { useAuth } from "../lib/auth";
import { cx } from "../lib/format";

/* The hero demo: one order travelling from QR → bank SMS → matched → webhook. */
const STAGES = ["qr", "sms", "matched", "webhook"] as const;
type Stage = (typeof STAGES)[number];

function useStage(): Stage {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setI(3);
      return;
    }
    const id = setInterval(() => setI((x) => (x + 1) % STAGES.length), 2200);
    return () => clearInterval(id);
  }, []);
  return STAGES[i];
}

function HeroDemo() {
  const stage = useStage();
  const at = STAGES.indexOf(stage);
  return (
    <div className="relative mx-auto w-full max-w-[440px]" aria-label="How a payment is verified" role="img">
      {/* checkout card */}
      <div className="relative overflow-hidden rounded-[28px] bg-white shadow-pop ring-1 ring-line">
        <div className="perforated relative bg-brand-600 px-6 pt-5 pb-6 text-white" style={{ ["--notch-bg" as string]: "#fff" }}>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-white/15 font-display font-bold">C</span>
            <div>
              <div className="font-display font-semibold">Chai Point Café</div>
              <div className="text-[11px] opacity-70">Receipt #A-2210</div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-0.5 text-[11px] font-semibold tabular">
              <Clock3 className="size-3" /> 14:32
            </span>
          </div>
          <div className="mt-4 font-display text-[40px] leading-none font-semibold tabular">
            ₹249<span className="text-xl opacity-70">.01</span>
          </div>
          <span className="notch-l" />
          <span className="notch-r" />
        </div>
        <div className="grid h-[236px] place-items-center px-6">
          {at < 2 ? (
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-line p-3">
                <QR value="upi://pay?pa=chaipoint@okhdfcbank&pn=Chai%20Point&am=249.01&cu=INR&tr=order_demo" size={150} />
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                {(["gpay", "phonepe", "paytm", "bhim"] as const).map((a) => (
                  <AppBadge key={a} app={a} size={24} />
                ))}
                <span className="text-[11px] font-semibold text-ink-3">Scan with any UPI app</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center" style={{ animation: "fade-up .4s both" }}>
              <svg viewBox="0 0 80 80" className="size-20">
                <circle cx="40" cy="40" r="38" fill="#0b8a5f" />
                <path d="M24 41.5 35 52l21-24" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60" style={{ animation: "draw .5s .1s forwards" }} />
              </svg>
              <div className="mt-3 text-lg font-semibold">Payment verified</div>
              <div className="font-mono text-xs text-ink-3">UTR 412345678901</div>
            </div>
          )}
        </div>
      </div>

      {/* SMS bubble */}
      <div
        className={cx(
          "absolute -left-4 top-[46%] w-[78%] rounded-2xl rounded-bl-md bg-ink p-3.5 text-[12px] leading-5 text-white shadow-pop transition-all duration-500 sm:-left-14",
          at >= 1 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-brand-300 uppercase">
          <MessageSquareText className="size-3.5" /> HDFCBK · forwarded
        </div>
        <span className="font-mono">
          Rs.<b className="text-amber-300">249.01</b> credited to a/c XX4421 by VPA ravi@okaxis. UPI Ref <b className="text-amber-300">412345678901</b>
        </span>
      </div>

      {/* webhook chip */}
      <div
        className={cx(
          "absolute -right-3 -bottom-5 flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold shadow-pop ring-1 ring-line transition-all duration-500 sm:-right-10",
          at >= 3 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <Webhook className="size-4 text-brand-600" />
        <span className="font-mono">order.paid</span>
        <span className="rounded-full bg-credit-soft px-1.5 text-credit">200 OK</span>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: QrCode, title: "Branded checkout", text: "Your logo and colour on a hosted page: UPI QR on desktop, one-tap app buttons on mobile." },
  { icon: MessageSquareText, title: "Automatic verification", text: "Forward bank credit SMS from any Android phone. We match each credit to its order by exact amount or UTR." },
  { icon: Link2, title: "Payment links", text: "Create a link, share it on WhatsApp, get notified when it's paid. With expiry and reference IDs." },
  { icon: Smartphone, title: "Quick Collect", text: "Type an amount at the counter, show a big QR, and watch it turn green when the money lands." },
  { icon: Webhook, title: "Signed webhooks", text: "HMAC-signed events with automatic retries for up to a day, a delivery log and one-click resend." },
  { icon: Lock, title: "Signed redirects", text: "Every successful checkout returns an og_signature your server can verify with your key secret." },
  { icon: FlaskConical, title: "Test mode", text: "Separate test data and keys, plus a simulator to try success and failure without moving money." },
  { icon: Users, title: "Team roles", text: "Owner, admin, developer and viewer logins, so your cashier doesn't see your API keys." },
  { icon: FileDown, title: "Reports", text: "Export orders, payments and refunds as CSV for any date range." },
];

const FAQ = [
  {
    q: "Where does the money go?",
    a: "Straight to your own UPI ID, and from there to your bank account. Customers pay you directly with their UPI app. OpenGateway never receives, holds, pools or routes the money — there's nothing to settle and nothing for us to hold back.",
  },
  {
    q: "Then how do you know a payment succeeded?",
    a: "Two ways. Automatically: install any SMS forwarder app on the Android phone that gets your bank's credit messages and point it at your private ingest URL — we read the amount and UTR and match it to the open order. Or manually: confirm the payment from your dashboard after you see it in your bank app, optionally checking the UTR the customer entered.",
  },
  {
    q: "What if two customers pay the same amount at the same time?",
    a: "Each open order on a UPI ID gets a unique payable amount — we add a few paise when needed (₹499.00 becomes ₹499.01). So every credit maps to exactly one order. If a UTR is available, we use that too.",
  },
  {
    q: "Is it really 0%?",
    a: "Yes. UPI person-to-merchant payments carry no MDR, and because we never touch the money there's no gateway fee to pass on. Your bank's own UPI limits and terms still apply.",
  },
  {
    q: "What doesn't it do?",
    a: "Cards, net banking, wallets and instant refunds aren't supported — it's UPI only. Refunds are sent by you from your UPI app; we record them and notify your systems. Verification depends on your SMS forwarder or on you confirming, so it's best suited to small and mid-size businesses.",
  },
  {
    q: "Is my data separate between test and live?",
    a: "Completely. Test and live have separate API keys, UPI IDs, orders, webhooks and forwarders. Test orders can be completed with the simulator.",
  },
];

const SNIPPET = `curl https://YOUR_GATEWAY/v1/orders \\
  -u og_test_xxxxxxxx:SECRET \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 49900, "receipt": "rcpt_1042" }'`;

const SNIPPET_JS = `<script src="https://YOUR_GATEWAY/checkout.js"></script>
<script>
  new OpenGateway({
    session_id: order.payment_session_id,
    onSuccess: ({ order_id, payment_id, signature }) =>
      verifyOnServer(order_id, payment_id, signature),
  }).open();
</script>`;

export default function Landing() {
  const { me } = useAuth();
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  return (
    <div className="bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-2 md:flex">
            <a href="#how" className="hover:text-brand-700">How it works</a>
            <a href="#features" className="hover:text-brand-700">Features</a>
            <a href="#pricing" className="hover:text-brand-700">Pricing</a>
            <Link to="/docs" className="hover:text-brand-700">Developers</Link>
            <a href="#faq" className="hover:text-brand-700">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {me ? (
              <Link to="/dashboard" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                Dashboard <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-paper sm:inline-flex">
                  Log in
                </Link>
                <Link to="/signup" className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-dots absolute inset-0 [mask-image:linear-gradient(180deg,#000_30%,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24 lg:pb-32">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <BadgeIndianRupee className="size-3.5" /> UPI payment gateway · ₹0 MDR
            </span>
            <h1 className="mt-5 text-[42px] leading-[1.02] font-bold tracking-[-0.025em] text-ink sm:text-[58px]">
              Accept UPI payments directly in your bank account.{" "}
              <span className="relative whitespace-nowrap text-brand-600">
                0% fees.
                <svg viewBox="0 0 200 12" className="absolute -bottom-2 left-0 w-full" aria-hidden preserveAspectRatio="none">
                  <path d="M2 9C50 3 150 2 198 7" stroke="#ffc94d" strokeWidth="5" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink-2">
              Customers pay your own UPI ID from any app. OpenGateway creates the order, shows a branded checkout, confirms the money arrived and tells your website — without ever touching the funds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 font-semibold text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] hover:bg-brand-700">
                Start accepting payments <ArrowRight className="size-4" />
              </Link>
              <Link to="/docs" className="inline-flex h-12 items-center rounded-xl border border-line-2 bg-white px-6 font-semibold text-ink hover:border-brand-300">
                Read the docs
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              {["Money settles to you instantly", "No KYC paperwork with us", "Live in minutes"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-credit" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="px-4 sm:px-10 lg:px-0">
            <HeroDemo />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-line bg-paper py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-2xl text-3xl font-semibold sm:text-4xl">From UPI ID to paid order in three steps</h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { t: "Add your UPI ID", d: "Use the UPI ID you already receive money on. Add a phone that forwards your bank's credit SMS, or plan to confirm by hand.", i: BadgeIndianRupee },
              { t: "Create an order", d: "From your server with one API call, from a payment link, or at the counter with Quick Collect. Each gets a checkout page.", i: QrCode },
              { t: "Get paid and notified", d: "The customer pays from any UPI app. We match the bank credit to the order, then send a signed webhook and redirect.", i: Bell },
            ].map((s, n) => (
              <li key={s.t} className="relative rounded-3xl bg-white p-6 ring-1 ring-line">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium text-brand-600">Step {n + 1}</span>
                  <span className="h-px flex-1 bg-line" />
                  <s.i className="size-5 text-brand-600" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 leading-7 text-ink-2">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold sm:text-4xl">Everything a payment gateway does, minus the cut</h2>
            <p className="mt-3 text-lg text-ink-2">A full merchant dashboard and developer API, built only for UPI.</p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-line ring-1 ring-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white p-6 transition-colors hover:bg-brand-50/40">
                <f.icon className="size-6 text-brand-600" />
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-7 text-ink-2">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Checkout preview */}
      <section className="overflow-hidden bg-brand-800 py-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold sm:text-4xl">A checkout your customers already understand</h2>
            <p className="mt-4 text-lg leading-8 text-brand-200">
              On a laptop they scan the QR. On a phone they tap their UPI app and the amount is filled in. Either way, the payment goes to you and the page updates the moment it's verified.
            </p>
            <ul className="mt-6 space-y-2.5 text-brand-100">
              {["Your logo and brand colour", "Live countdown to expiry", "Optional UTR entry for faster checks", "Works embedded in a modal or as a redirect"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 text-amber-300" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-end justify-center gap-5">
            {/* phone */}
            <div className="w-[230px] shrink-0 rounded-[36px] bg-ink p-2.5 shadow-2xl ring-1 ring-white/10">
              <div className="overflow-hidden rounded-[28px] bg-paper">
                <div className="bg-[#0f766e] px-4 pt-6 pb-4 text-white">
                  <div className="text-xs font-semibold opacity-95">Green Basket Organics</div>
                  <div className="mt-1 font-display text-3xl font-semibold tabular">₹1,240<span className="text-base opacity-90">.00</span></div>
                </div>
                <div className="space-y-1.5 p-3">
                  {(["gpay", "phonepe", "paytm", "bhim"] as const).map((a) => (
                    <div key={a} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-[12px] font-semibold text-ink ring-1 ring-line">
                      <AppBadge app={a} size={22} />
                      {a === "gpay" ? "Google Pay" : a === "phonepe" ? "PhonePe" : a === "paytm" ? "Paytm" : "BHIM"}
                    </div>
                  ))}
                  <div className="mt-2 rounded-xl bg-[#0f766e] py-2 text-center text-[12px] font-semibold text-white">I have paid</div>
                </div>
              </div>
            </div>
            {/* desktop card */}
            <div className="hidden w-[260px] shrink-0 overflow-hidden rounded-3xl bg-white text-ink shadow-2xl sm:block">
              <div className="bg-brand-600 px-5 py-4 text-white">
                <div className="text-xs font-semibold opacity-80">Acme Store</div>
                <div className="font-display text-3xl font-semibold tabular">₹499<span className="text-base opacity-70">.01</span></div>
              </div>
              <div className="flex flex-col items-center p-5">
                <QR value="upi://pay?pa=acme@okicici&pn=Acme&am=499.01&cu=INR" size={140} />
                <div className="mt-3 text-xs font-semibold text-ink-3">Scan with any UPI app</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-10 rounded-[32px] bg-paper p-8 ring-1 ring-line sm:p-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <div className="text-sm font-semibold text-brand-700">Pricing</div>
              <div className="mt-2 font-display text-[88px] leading-none font-bold tracking-tight text-ink">
                ₹0<span className="ml-2 align-top text-2xl font-semibold text-ink-3">MDR</span>
              </div>
              <p className="mt-4 max-w-sm text-ink-2">No setup fee, no per-transaction fee, no settlement fee. We can't take a cut of money we never touch.</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {["Unlimited orders and links", "Test and live modes", "Webhooks with retries", "Unlimited team members", "CSV reports", "Hosted checkout and checkout.js"].map((t) => (
                <li key={t} className="flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 text-[15px] font-medium ring-1 ring-line">
                  <span className="grid size-6 place-items-center rounded-full bg-credit-soft">
                    <Check className="size-3.5 text-credit" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Developers */}
      <section className="border-y border-line bg-paper py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 className="text-3xl font-semibold sm:text-4xl">Integrate in an afternoon</h2>
            <p className="mt-4 text-lg leading-8 text-ink-2">Create an order on your server, open checkout in the browser, verify the signature. A REST API with idempotency keys, paise-precise amounts and familiar object shapes.</p>
            <Link to="/docs" className="mt-6 inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline">
              Read the quickstart <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="min-w-0 space-y-3">
            <CodeCard title="1 · Create an order" code={SNIPPET} />
            <CodeCard title="2 · Open checkout" code={SNIPPET_JS} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold sm:text-4xl">Straight answers</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map((f, i) => (
              <div key={f.q}>
                <h3>
                  <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} aria-expanded={faqOpen === i} className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-semibold">
                    {f.q}
                    <ChevronDown className={cx("size-5 shrink-0 text-ink-3 transition-transform", faqOpen === i && "rotate-180")} />
                  </button>
                </h3>
                {faqOpen === i && <p className="-mt-1 pb-5 leading-7 text-ink-2">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[32px] bg-brand-600 p-10 text-white sm:flex-row sm:items-center sm:p-14">
          <div>
            <h2 className="text-3xl font-semibold">Take your first UPI payment today.</h2>
            <p className="mt-2 text-brand-100">Free to start. Test mode needs nothing but an email.</p>
          </div>
          <Link to="/signup" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-white px-6 font-semibold text-brand-700 hover:bg-brand-50">
            Create free account <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-6 text-ink-3">UPI payments that go straight to your bank account. OpenGateway is software, not a bank or payment aggregator, and never holds funds.</p>
          </div>
          {[
            { h: "Product", l: [["Features", "#features"], ["Pricing", "#pricing"], ["FAQ", "#faq"]] },
            { h: "Developers", l: [["Docs", "/docs"], ["API reference", "/docs#reference"], ["Webhooks", "/docs#webhooks"]] },
            { h: "Account", l: [["Log in", "/login"], ["Sign up", "/signup"], ["Dashboard", "/dashboard"]] },
          ].map((c) => (
            <div key={c.h}>
              <div className="text-sm font-semibold">{c.h}</div>
              <ul className="mt-3 space-y-2 text-sm text-ink-3">
                {c.l.map(([t, h]) => (
                  <li key={t}>
                    {h.startsWith("#") ? (
                      <a href={h} className="hover:text-brand-700">{t}</a>
                    ) : (
                      <Link to={h} className="hover:text-brand-700">{t}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-ink-3 sm:px-6">
            <span className="flex items-center gap-1.5">
              <LogoMark className="size-4" /> © {new Date().getFullYear()} OpenGateway
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> UPI is a trademark of NPCI. App names belong to their owners.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CodeCard({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-ink ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs font-semibold text-brand-200">
        <span className="flex gap-1">
          <span className="size-2 rounded-full bg-white/20" />
          <span className="size-2 rounded-full bg-white/20" />
          <span className="size-2 rounded-full bg-white/20" />
        </span>
        {title}
      </div>
      <pre tabIndex={0} aria-label={`${title} code sample`} className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-brand-100">{code}</pre>
    </div>
  );
}
