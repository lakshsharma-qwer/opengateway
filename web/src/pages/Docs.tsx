import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Menu, X } from "lucide-react";
import { Logo } from "../components/Logo";
import { CopyButton } from "../components/ui";
import { cx } from "../lib/format";
import { EVENT_TYPES } from "../lib/types";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://YOUR_GATEWAY";

/* ------------------------------ code tabs ------------------------------ */

function Code({ tabs }: { tabs: { label: string; code: string }[] }) {
  const [i, setI] = useState(0);
  return (
    <div className="my-5 overflow-hidden rounded-2xl bg-ink ring-1 ring-black/5">
      <div className="flex items-center border-b border-white/10 pr-2">
        <div role="tablist" className="flex flex-1 overflow-x-auto">
          {tabs.map((t, n) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={i === n}
              onClick={() => setI(n)}
              className={cx("border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap", i === n ? "border-amber-300 text-white" : "border-transparent text-brand-300 hover:text-white")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CopyButton value={tabs[i].code} className="text-brand-200 hover:bg-white/10 hover:text-white" />
      </div>
      <pre tabIndex={0} role="tabpanel" aria-label={`${tabs[i].label} code sample`} className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-brand-50">{tabs[i].code}</pre>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-2xl ring-1 ring-line">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-paper">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 text-xs font-semibold tracking-wide text-ink-3 uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line align-top">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-2.5 text-ink-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const M = ({ children }: { children: ReactNode }) => <code className="font-mono text-[12.5px] text-brand-800">{children}</code>;
function Method({ m }: { m: string }) {
  const c = m === "GET" ? "bg-sky-50 text-sky-700" : m === "POST" ? "bg-credit-soft text-credit" : m === "PATCH" ? "bg-marigold-soft text-[#9a4d00]" : "bg-danger-soft text-danger";
  return <span className={cx("rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold", c)}>{m}</span>;
}

/* ------------------------------ reference data (from SPEC.md) ------------------------------ */

const V1: [string, string, string, string][] = [
  ["POST", "/v1/orders", "amount (int paise, 100–10000000), currency?, receipt?, notes? (≤15 keys), customer?, expire_in? (120–86400 s), return_url?, vpa_id?", "Order (201)"],
  ["GET", "/v1/orders", "status, receipt, count, skip, from, to", "Collection of Order"],
  ["GET", "/v1/orders/:id", "—", "Order"],
  ["GET", "/v1/orders/:id/payments", "—", "Collection of Payment"],
  ["POST", "/v1/orders/:id/cancel", "Only created/attempted orders", "Order"],
  ["GET", "/v1/payments", "status, count, skip, from, to", "Collection of Payment"],
  ["GET", "/v1/payments/:id", "—", "Payment"],
  ["POST", "/v1/refunds", "payment_id, amount? (default: full remaining), notes?", "Refund (201)"],
  ["GET", "/v1/refunds", "count, skip, from, to", "Collection of Refund"],
  ["GET", "/v1/refunds/:id", "—", "Refund"],
  ["POST", "/v1/payment_links", "amount, description?, reference_id?, customer?, expire_by?", "Payment link (201)"],
  ["GET", "/v1/payment_links", "count, skip, from, to", "Collection of Payment link"],
  ["GET", "/v1/payment_links/:id", "—", "Payment link"],
  ["POST", "/v1/payment_links/:id/cancel", "—", "Payment link"],
  ["POST", "/v1/test/orders/:id/simulate", '{ "outcome": "success" | "failure" } — test keys only', "Order"],
  ["POST", "/v1/observers/ingest", "text|message|msg|body|sms, from|sender?, received_at? · auth: X-Observer-Token or ?token=", "{ ok, observation_id, status, order_id }"],
];

const ORDER_FIELDS: [string, string, string][] = [
  ["id", "string", "order_ + 14 chars"],
  ["amount", "integer", "Requested amount in paise"],
  ["amount_payable", "integer", "What the customer must pay. May be up to 99 paise more than amount so each open order on a UPI ID is unique."],
  ["amount_paid", "integer", "Captured amount in paise"],
  ["status", "enum", "created · attempted · paid · expired · cancelled"],
  ["receipt", "string | null", "Your reference"],
  ["notes", "object", "Up to 15 key–value pairs"],
  ["customer", "object | null", "{ name, email, phone }"],
  ["vpa / payee_name", "string", "The UPI ID the customer pays"],
  ["payment_session_id", "string", "ps_ + 24 chars. Pass to checkout.js"],
  ["checkout_url", "string", "Hosted checkout page"],
  ["return_url", "string | null", "Where checkout sends the customer when done"],
  ["utr", "string | null", "UPI reference of the captured payment"],
  ["expires_at / paid_at / created_at", "unix seconds", ""],
];

const ERRORS: [string, string, string][] = [
  ["401", "INVALID_API_KEY", "Missing or wrong key ID / secret"],
  ["400", "VALIDATION_ERROR", "A field is invalid; see error.field"],
  ["404", "NOT_FOUND", "The object doesn't exist in this mode"],
  ["409", "VPA_BUSY", "All 100 unique-amount slots for this amount are taken on this UPI ID"],
  ["400", "NO_VPA_CONFIGURED", "Add a UPI ID for this mode first"],
  ["400", "ORDER_NOT_CANCELLABLE", "Only created/attempted orders can be cancelled"],
  ["400", "REFUND_AMOUNT_EXCEEDED", "Refunds would exceed the payment amount"],
  ["403", "TEST_MODE_ONLY", "Simulation needs a test key"],
  ["409", "IDEMPOTENCY_KEY_REUSED", "Same Idempotency-Key, different body"],
  ["429", "—", "Rate limited; see Retry-After"],
];

const SECTIONS = [
  ["overview", "How it works"],
  ["auth", "Authentication"],
  ["create-order", "1. Create an order"],
  ["checkout", "2. Open checkout"],
  ["verify-signature", "3. Verify the signature"],
  ["webhooks", "4. Handle webhooks"],
  ["test-mode", "Test mode & simulation"],
  ["observer", "SMS verification setup"],
  ["reference", "API reference"],
  ["objects", "Order object"],
  ["errors", "Errors & limits"],
] as const;

export default function Docs() {
  const [active, setActive] = useState<string>("overview");
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    document.title = "Docs · OpenGateway";
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const toc = (
    <nav aria-label="Docs" className="space-y-0.5 text-sm">
      {SECTIONS.map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={() => setNavOpen(false)}
          className={cx("block rounded-lg px-3 py-1.5 transition-colors", active === id ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-2 hover:text-ink")}
        >
          {label}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <button className="grid size-9 place-items-center rounded-lg hover:bg-paper lg:hidden" aria-label="Open docs menu" onClick={() => setNavOpen(true)}>
            <Menu className="size-5" />
          </button>
          <Link to="/">
            <Logo />
          </Link>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Docs</span>
          <Link to="/dashboard/developers/api-keys" className="ml-auto inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            Get API keys
          </Link>
        </div>
      </header>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white p-4 shadow-pop">
            <button aria-label="Close" onClick={() => setNavOpen(false)} className="mb-4 grid size-8 place-items-center rounded-lg hover:bg-paper">
              <X className="size-4" />
            </button>
            {toc}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl gap-10 px-4 sm:px-6">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 overflow-y-auto py-8 lg:block">
          <Link to="/" className="mb-6 inline-flex items-center gap-1 px-3 text-xs font-semibold text-ink-3 hover:text-ink">
            <ArrowLeft className="size-3.5" /> Home
          </Link>
          {toc}
        </aside>

        <main className="prose-doc min-w-0 max-w-3xl flex-1 py-10">
          <h1 className="text-4xl font-bold tracking-tight">Accept UPI with OpenGateway</h1>
          <p className="mt-3 text-lg">Create an order on your server, send the customer to checkout, and confirm the result with a signed redirect and webhook. All amounts are integers in paise; all timestamps are unix seconds.</p>

          <h2 id="overview">How it works</h2>
          <p>
            The customer pays <b>your UPI ID directly</b> from any UPI app. OpenGateway never receives the money. To know a payment arrived, we read the credit SMS your bank sends you (forwarded from your Android phone), match it to the order by its exact <code>amount_payable</code> or UTR, and mark the order paid. You can also confirm payments by hand in the dashboard.
          </p>
          <ul>
            <li>
              <b>Order</b> — what you want to collect. Status: <code>created → attempted → paid</code>, or <code>expired</code> / <code>cancelled</code>.
            </li>
            <li>
              <b>Payment</b> — one attempt on an order: <code>created → pending_verification → captured</code>, or <code>failed</code>.
            </li>
            <li>
              <b>Verification</b> — by <code>observer</code> (forwarded SMS), <code>merchant</code> (manual) or <code>simulator</code> (test mode).
            </li>
          </ul>

          <h2 id="auth">Authentication</h2>
          <p>
            Call <code>/v1</code> with HTTP Basic auth: your key ID (<code>og_test_…</code> or <code>og_live_…</code>) as the username and the key secret as the password. The key decides the mode — test keys only see test data. Keep the secret on your server.
          </p>
          <p>
            Every <code>POST /v1/*</code> accepts an <code>Idempotency-Key</code> header. Repeating a request with the same key and body within 24 hours replays the original response with <code>Idempotent-Replayed: true</code>.
          </p>

          <h2 id="create-order">1. Create an order</h2>
          <p>Create the order on your server when the customer clicks pay. Store the returned <code>id</code> against your own order.</p>
          <Code
            tabs={[
              {
                label: "curl",
                code: `curl ${ORIGIN}/v1/orders \\
  -u $OG_KEY_ID:$OG_KEY_SECRET \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: rcpt_1042" \\
  -d '{
    "amount": 49900,
    "receipt": "rcpt_1042",
    "customer": { "name": "Priya", "phone": "9876543210" },
    "return_url": "https://yourstore.com/payment/return",
    "notes": { "cart_id": "c_88" }
  }'`,
              },
              {
                label: "Node.js",
                code: `const auth = Buffer.from(\`\${process.env.OG_KEY_ID}:\${process.env.OG_KEY_SECRET}\`).toString("base64");

const res = await fetch("${ORIGIN}/v1/orders", {
  method: "POST",
  headers: {
    Authorization: \`Basic \${auth}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": "rcpt_1042",
  },
  body: JSON.stringify({
    amount: 49900,                 // ₹499.00 in paise
    receipt: "rcpt_1042",
    return_url: "https://yourstore.com/payment/return",
  }),
});
const order = await res.json();
if (!res.ok) throw new Error(order.error.message);
// order.payment_session_id → give to the browser
// order.checkout_url       → or redirect the customer here`,
              },
              {
                label: "Python",
                code: `import os, requests

r = requests.post(
    "${ORIGIN}/v1/orders",
    auth=(os.environ["OG_KEY_ID"], os.environ["OG_KEY_SECRET"]),
    headers={"Idempotency-Key": "rcpt_1042"},
    json={
        "amount": 49900,  # ₹499.00 in paise
        "receipt": "rcpt_1042",
        "return_url": "https://yourstore.com/payment/return",
    },
    timeout=10,
)
r.raise_for_status()
order = r.json()
print(order["id"], order["amount_payable"], order["checkout_url"])`,
              },
            ]}
          />
          <p>
            Note <code>amount_payable</code>: when another open order on the same UPI ID already has that amount, we add a paisa (up to 99) so every bank credit matches exactly one order. You can turn this off in Settings → Checkout, but then matching needs the customer's UTR.
          </p>

          <h2 id="checkout">2. Open checkout</h2>
          <p>
            Load <code>checkout.js</code> and pass the <code>payment_session_id</code>. In <b>modal</b> mode the checkout opens in an overlay on your page; in <b>redirect</b> mode the browser goes to <code>checkout_url</code> and returns to your <code>return_url</code>.
          </p>
          <Code
            tabs={[
              {
                label: "Modal",
                code: `<script src="${ORIGIN}/checkout.js"></script>
<button id="pay">Pay ₹499</button>
<script>
  document.getElementById("pay").onclick = () => {
    const og = new OpenGateway({
      session_id: "ps_...",            // order.payment_session_id
      mode: "modal",
      onSuccess: (r) => {
        // { order_id, payment_id, signature } — verify on your server
        fetch("/payment/verify", { method: "POST", body: JSON.stringify(r) });
      },
      onFailure: (r) => console.log("Not paid:", r.status),
      onClose: () => console.log("Customer closed checkout"),
    });
    og.open();
  };
</script>`,
              },
              {
                label: "Redirect",
                code: `// Server: after creating the order
res.redirect(order.checkout_url);

// The customer comes back to your return_url with:
// ?og_order_id=order_...&og_payment_id=pay_...&og_status=paid&og_signature=...
// or ?og_order_id=order_...&og_status=failed|expired|cancelled`,
              },
            ]}
          />

          <h2 id="verify-signature">3. Verify the signature</h2>
          <p>
            Never trust the browser alone. <code>og_signature</code> is <code>HMAC_SHA256(key_secret, order_id + "|" + payment_id)</code> in hex, signed with your <b>current active key</b> for that mode. Compare in constant time, then fetch the order to be sure.
          </p>
          <Code
            tabs={[
              {
                label: "Node.js",
                code: `import crypto from "node:crypto";

export function verifyCheckout({ order_id, payment_id, signature }) {
  const expected = crypto
    .createHmac("sha256", process.env.OG_KEY_SECRET)
    .update(\`\${order_id}|\${payment_id}\`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature ?? "", "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}`,
              },
              {
                label: "Python",
                code: `import hmac, hashlib, os

def verify_checkout(order_id: str, payment_id: str, signature: str) -> bool:
    expected = hmac.new(
        os.environ["OG_KEY_SECRET"].encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")`,
              },
            ]}
          />

          <h2 id="webhooks">4. Handle webhooks</h2>
          <p>
            Add an endpoint in Developers → Webhooks. Each delivery is a <code>POST</code> of the event JSON with an <code>X-OpenGateway-Signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code> header, where <code>v1 = HMAC_SHA256(endpoint_secret, t + "." + rawBody)</code>. Reply with any 2xx within 8 seconds. Failed deliveries retry after 1 m, 5 m, 30 m, 2 h, 6 h and 12 h.
          </p>
          <Code
            tabs={[
              {
                label: "Node.js (Express)",
                code: `import crypto from "node:crypto";
import express from "express";

const app = express();
app.post("/webhooks/opengateway", express.raw({ type: "application/json" }), (req, res) => {
  const header = req.get("X-OpenGateway-Signature") ?? "";
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto
    .createHmac("sha256", process.env.OG_WEBHOOK_SECRET)
    .update(\`\${parts.t}.\${req.body}\`)
    .digest("hex");
  const ok =
    parts.v1 && expected.length === parts.v1.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  if (!ok || !fresh) return res.sendStatus(400);

  const event = JSON.parse(req.body);
  if (event.type === "order.paid") {
    // mark event.data.order.id as paid — make this idempotent by event.id
  }
  res.sendStatus(200);
});`,
              },
              {
                label: "Python (Flask)",
                code: `import hmac, hashlib, os, time, json
from flask import Flask, request, abort

app = Flask(__name__)

@app.post("/webhooks/opengateway")
def og_webhook():
    raw = request.get_data()  # bytes, exactly as sent
    parts = dict(p.split("=", 1) for p in request.headers.get("X-OpenGateway-Signature", "").split(",") if "=" in p)
    expected = hmac.new(
        os.environ["OG_WEBHOOK_SECRET"].encode(),
        parts.get("t", "").encode() + b"." + raw,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, parts.get("v1", "")):
        abort(400)
    if abs(time.time() - int(parts["t"])) > 300:
        abort(400)
    event = json.loads(raw)
    if event["type"] == "order.paid":
        pass  # fulfil event["data"]["order"]["id"], idempotently by event["id"]
    return "", 200`,
              },
            ]}
          />
          <p>Event types:</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {EVENT_TYPES.map((e) => (
              <code key={e}>{e}</code>
            ))}
          </div>

          <h2 id="test-mode">Test mode & simulation</h2>
          <p>
            Test keys (<code>og_test_…</code>) create test orders against your test UPI ID. On a test checkout you'll see <b>Simulate success</b> and <b>Simulate failure</b> buttons; from your server you can do the same:
          </p>
          <Code
            tabs={[
              {
                label: "curl",
                code: `curl -X POST ${ORIGIN}/v1/test/orders/order_XXXXXXXXXXXXXX/simulate \\
  -u $OG_TEST_KEY_ID:$OG_TEST_KEY_SECRET \\
  -H "Content-Type: application/json" \\
  -d '{ "outcome": "success" }'`,
              },
            ]}
          />
          <p>Simulated payments are captured with <code>verified_by: "simulator"</code> and fire the same webhooks and redirects as real ones. Live keys get 403 <code>TEST_MODE_ONLY</code>.</p>

          <h2 id="observer">SMS verification setup</h2>
          <p>
            In Verification → SMS forwarders, create a forwarder to get a private ingest URL. Point any Android "SMS forwarder" app at it. We accept JSON, form-encoded or plain-text bodies, with the message in <code>text</code>, <code>message</code>, <code>msg</code>, <code>body</code> or <code>sms</code>. The token can go in the <code>X-Observer-Token</code> header or the <code>?token=</code> query.
          </p>
          <Code
            tabs={[
              {
                label: "curl",
                code: `curl -X POST "${ORIGIN}/v1/observers/ingest?token=YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "from": "HDFCBK", "text": "Rs.499.01 credited to a/c XX4421 by VPA priya@okaxis. UPI Ref 412345678901" }'

# → { "ok": true, "observation_id": "obsv_...", "status": "matched", "order_id": "order_..." }`,
              },
            ]}
          />
          <ul>
            <li>Debits and messages without an amount are ignored. Repeats (same UTR, or same text within 10 minutes) are marked duplicate.</li>
            <li>A credit is matched when its UTR equals a UTR the customer entered, or when exactly one open order has that <code>amount_payable</code>.</li>
            <li>Anything else lands in <b>Unmatched credits</b>, where you can attach it to an order or ignore it.</li>
          </ul>

          <h2 id="reference">API reference</h2>
          <p>
            Base URL <code>{ORIGIN}</code>. Lists return <code>{"{ entity: \"collection\", count, has_more, items }"}</code> and accept <code>count</code> (max 100), <code>skip</code>, <code>from</code> and <code>to</code>.
          </p>
          <Table
            head={["Endpoint", "Parameters", "Returns"]}
            rows={V1.map(([m, p, params, ret]) => [
              <span key="e" className="flex items-center gap-2 whitespace-nowrap">
                <Method m={m} /> <M>{p}</M>
              </span>,
              <span key="p" className="text-[13px]">{params}</span>,
              <span key="r" className="text-[13px] whitespace-nowrap">{ret}</span>,
            ])}
          />

          <h2 id="objects">Order object</h2>
          <Table head={["Field", "Type", "Description"]} rows={ORDER_FIELDS.map(([f, t, d]) => [<M key="f">{f}</M>, <span key="t" className="text-[13px]">{t}</span>, <span key="d" className="text-[13px]">{d}</span>])} />
          <p>
            Payments add <code>flow</code> (<code>qr</code> · <code>intent</code> · <code>manual</code>), <code>upi_app</code>, <code>utr</code>, <code>payer_vpa</code> and <code>verified_by</code>. Refunds are <code>pending → processed | failed</code>; you send the money from your UPI app and mark it processed in the dashboard.
          </p>

          <h2 id="errors">Errors & limits</h2>
          <p>
            Errors return <code>{"{ error: { type, code, message, field } }"}</code>. Limits: 120 requests/min per key on <code>/v1</code>; responses carry <code>RateLimit-*</code> headers.
          </p>
          <Table head={["HTTP", "Code", "Meaning"]} rows={ERRORS.map(([h, c, d]) => [<span key="h" className="font-mono">{h}</span>, <M key="c">{c}</M>, <span key="d" className="text-[13px]">{d}</span>])} />
        </main>
      </div>
    </div>
  );
}
