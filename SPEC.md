# OpenGateway — Platform Spec (contract between `server/` and `web/`)

OpenGateway is a multi-merchant, PhonePe-PG-style UPI payment platform.

**Funds model.** Customers pay with any UPI app (GPay, PhonePe, Paytm, BHIM…). The money goes **directly to the merchant's own UPI ID (VPA)**. The platform never holds, pools or routes funds and charges 0% MDR.

The platform's job is to:
1. create orders,
2. render a branded checkout (UPI QR on desktop, UPI app intent buttons on mobile),
3. **verify** that the credit arrived,
4. notify the merchant (webhooks, signed redirect),
5. give merchants a full dashboard.

**Verification sources:**
- **Observer ingest.** Bank credit SMS or notifications are forwarded by any "SMS forwarder" Android app to a per-merchant HTTPS endpoint. The server parses them and matches them to an open order by exact payable amount.
- **Merchant manual confirmation** in the dashboard, optionally against a UTR the customer entered.
- **Simulator** (test mode only).

`youpi-src/` is a reference clone of YouPI-PG. It has **no license**, so do not copy code from it. Ideas only.

## Layout / runtime

```
opengateway/
  server/        Node 26, ESM JS, Express 5, node:sqlite (DatabaseSync). Port 4000.
    public/checkout.js   merchant browser SDK (served at /checkout.js)
  web/           Vite + React 18 + TypeScript + Tailwind v4 + react-router. Dev port 5173.
  demo-store/    tiny Express merchant store using the API + checkout.js. Port 5050.
  knowledge/     research notes (Razorpay, Cashfree, PhonePe)
```

- **Dev:** `web` (5173) proxies `/api`, `/v1`, `/l`, `/checkout.js` and `/health` to `http://localhost:4000`.
- **Prod:** `server` serves `web/dist` statically with SPA fallback (any non-API GET → `index.html`).
- **Env (server):**
  - `PORT=4000`
  - `PUBLIC_URL` (base for checkout links; dev default `http://localhost:5173`)
  - `DATA_DIR=./data`
  - `MASTER_KEY` (32-byte hex). If absent, auto-generated into `data/master.key`.
  - `ALLOWED_ORIGINS` (optional, comma separated): extra origins allowed to make cookie-authenticated state-changing `/api` calls (see CSRF below).
  - `TRUST_PROXY` (optional, default `loopback`): Express `trust proxy` value; set it when behind a reverse proxy so per-IP rate limits see the client IP.
  - `OG_STRICT_WEBHOOKS=1` (optional): also block loopback webhook targets in test mode.
- **Root `package.json` scripts:**
  - `dev` runs server + web concurrently.
  - `start` serves a prod build.
  - `test` runs server tests.

## Conventions

- **Money:** always integer **paise** in APIs and the DB. `amount: 49900` = ₹499.00. Currency is always `INR`.
- **IDs:** prefix + 14 random base62 chars.

  | Object | Prefix |
  |---|---|
  | merchant | `mid_` |
  | user | `usr_` |
  | VPA | `vpa_` |
  | API key | `og_test_` / `og_live_` (key_id) |
  | order | `order_` |
  | payment | `pay_` |
  | refund | `rfnd_` |
  | payment link | `plink_` |
  | observer | `obs_` |
  | observation | `obsv_` |
  | webhook endpoint | `wh_` |
  | webhook delivery | `whd_` |
  | event | `evt_` |
  | payment session | `ps_` + 24 chars |

- **Timestamps:** unix seconds (integers) in all API responses.
- **Mode:** every merchant-owned object has `mode: "test" | "live"`, and data is fully isolated per mode.
  - Merchant API: mode comes from the API key used.
  - Dashboard API: mode comes from query param `?mode=test|live` (default `test`).
- **Lists:** `{ "entity": "collection", "count": n, "has_more": bool, "items": [...] }`.
  - Query params: `count` (default 25, max 100), `skip`, `from` and `to` (unix created_at), plus per-endpoint filters.
- **Errors:** HTTP 4xx/5xx with `{ "error": { "type": "invalid_request_error|authentication_error|not_found_error|conflict_error|rate_limit_error|api_error", "code": "SNAKE_CASE_CODE", "message": "human text", "field": "amount" | null } }`.
- **Idempotency:** any `POST /v1/*` may send an `Idempotency-Key` header (stored 24h per merchant+mode).
  - Same key with the same body → replay the stored response with header `Idempotent-Replayed: true`.
  - Same key with a different body → 409 `IDEMPOTENCY_KEY_REUSED`.
- **Rate limiting:** 120 req/min per key on `/v1`, 20 req/min per IP on `/api/auth/*` and `/api/checkout/*/confirm`, 300 req/min per IP on all `/api/checkout/*` calls and on `/v1/observers/ingest` (checked before the token), plus 120/min per observer. Responses carry `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` headers. Over the limit → 429 with `Retry-After`.
- **Other error codes:** 413 `PAYLOAD_TOO_LARGE` (JSON bodies are limited to 100 KB, ingest to 64 KB), 403 `CSRF_REJECTED`, 429 `ACCOUNT_LOCKED`, 503 `SERVICE_BUSY` (database locked; retry), 409 `CONFLICT` (rare uniqueness race). Malformed JSON → 400 `VALIDATION_ERROR`. Error responses never contain stack traces.
- **Pagination bounds:** `count` 1–100, `skip` 0–1,000,000, `from`/`to` non-negative integers. Anything else → 400 `VALIDATION_ERROR`.

## Entities (API shapes)

### Order
```json
{
  "id": "order_...", "entity": "order", "mode": "test",
  "amount": 49900, "amount_payable": 49901, "amount_paid": 0, "currency": "INR",
  "receipt": "rcpt_1", "notes": {"k":"v"},
  "customer": {"name": "...", "email": "...", "phone": "..."},
  "status": "created",
  "vpa": "merchant@okhdfc", "payee_name": "Acme Store",
  "payment_session_id": "ps_...", "checkout_url": "{PUBLIC_URL}/pay/ps_...",
  "return_url": "https://merchant/return" ,
  "payment_link_id": null,
  "utr": null, "paid_at": null, "expires_at": 1700000900, "created_at": 1700000000
}
```

- **Status values:**
  - `created`: no attempt yet.
  - `attempted`: checkout opened, payment exists.
  - `paid`: captured.
  - `expired`: `expires_at` passed without payment.
  - `cancelled`: by the merchant via the API, or by the customer cancelling checkout.
- **`amount_payable` (unique-amount rule):** when an order is created, if another order **of the same merchant in the same mode (any VPA)** holds the same `amount_payable`, add 1 paisa and repeat, up to +99. If all 100 slots are busy → 409 `VPA_BUSY`. An order *holds* its slot while it is open, **and for a 15-minute grace window after it leaves the open state** (expired, cancelled or paid), so a bank SMS that arrives late can never be attributed to a newer order with the same amount. Uniqueness is merchant-wide (not per VPA) because one observer phone cannot tell which VPA was credited. It is controlled by the merchant setting `unique_amount` (default true). When false, `amount_payable = amount` and duplicate open amounts are allowed (matching then needs a UTR).
- **Expiry:** `expire_in` (seconds) on create. Default is the merchant setting `order_expiry_seconds` (default 900). Range 120–86400.
- **Expiry sweeper:** a background job runs every 15 s.
  - It expires overdue orders: status → `expired`, open payments → `failed` with `error_code: "ORDER_EXPIRED"`, event `order.expired`. It is idempotent (each order expires and emits once, however often it runs).
  - **Late credits:** an `expired` order can still become `paid` if an observed bank credit for it arrives within 15 minutes of `expires_at` (or if the merchant marks it paid). Integrations must accept `order.paid` after `order.expired`.
  - It processes webhook retries.

### Payment (an attempt on an order)
```json
{
  "id":"pay_...","entity":"payment","mode":"test","order_id":"order_...",
  "amount":49901,"currency":"INR",
  "status":"created",
  "method":"upi","flow":"qr",
  "upi_app": null,
  "utr": null, "payer_vpa": null,
  "verified_by": null,
  "observation_id": null,
  "error_code": null, "error_description": null,
  "created_at":0, "captured_at": null
}
```

- **`status`:** `created` | `pending_verification` | `captured` | `failed`.
- **`flow`:** `qr` | `intent` | `manual`.
- **`upi_app`:** `gpay` | `phonepe` | `paytm` | `bhim` | `cred` | `other` | null.
- **`utr`:** UTR claimed by the customer or observed.
- **`verified_by`:** `observer` | `merchant` | `simulator` | null.
- **`amount`:** set to `amount_payable` on creation. When captured by an observed credit, it is the credited amount (always between the order's `amount` and `amount_payable`); refunds are capped by it.

There is at most one non-failed payment per order at a time. When an order becomes `paid`, its payment is `captured`.

**Who can capture.** Only an observed credit (observer), the merchant (dashboard mark-paid / attach) or the test simulator. A UTR typed by the customer at checkout **never** captures on its own; it only helps attribute a real observed credit. A UTR can be captured once per merchant+mode (test) and **once across all merchants in live mode**; reuse → 409 `UTR_ALREADY_USED`.

### Refund
```json
{ "id":"rfnd_...","entity":"refund","mode":"test","payment_id":"pay_...","order_id":"order_...",
  "amount":10000,"currency":"INR","status":"pending","notes":{},"utr":null,
  "created_at":0,"processed_at":null }
```

- **Status:** `pending` | `processed` | `failed`.
- Refunds are paid back by the merchant from their own UPI app. The platform records them, and the merchant marks a refund `processed` (with an optional UTR) in the dashboard.
- Validation:
  - The payment must be `captured`.
  - The sum of non-failed refunds must be ≤ the payment amount; otherwise 400 `REFUND_AMOUNT_EXCEEDED`.

### Payment link
```json
{ "id":"plink_...","entity":"payment_link","mode":"test","amount":49900,"currency":"INR",
  "description":"...","reference_id":"...","customer":{...},
  "short_url":"{PUBLIC_URL}/l/AbC123x","status":"active",
  "expire_by": null, "paid_at": null, "order_id": null, "created_at":0 }
```

- **Status:** `active` | `paid` | `expired` | `cancelled`.
- **`GET /l/:code`:**
  - If the link is active and has a reusable open order, it 302-redirects to that order's `checkout_url`.
  - Otherwise it creates a new order (`payment_link_id` set, `return_url` = `{PUBLIC_URL}/l/:code/done`) and redirects.
  - If the link is paid, expired or cancelled, it redirects to `{PUBLIC_URL}/link-status/:code`, an SPA page that calls `GET /api/public/links/:code`.
- When the order is paid, the link becomes `paid` and the event `payment_link.paid` fires.
- Cancelling a link also cancels its open checkout order (payment `failed`, `error_code: "LINK_CANCELLED"`).

### Event + webhook
- **Event:** `{ "id":"evt_...","entity":"event","type":"order.paid","mode":"test","created_at":0,"data":{ "order":{...}, "payment":{...} } }`.
- **Types:**
  - `order.paid`
  - `order.expired`
  - `order.cancelled`
  - `payment.pending_verification`
  - `payment.captured`
  - `payment.failed`
  - `refund.created`
  - `refund.processed`
  - `payment_link.paid`
- **Webhook endpoint:** `{ id, mode, url, description, events:["order.paid",...] or ["*"], active, secret (only returned on create and by the "reveal" action), created_at, last_delivery_at, failure_count }`.
- **URL rules (SSRF protection):** `http`/`https` only, no embedded credentials. Live endpoints must resolve to public addresses: loopback, private (RFC 1918, CGNAT), link-local (incl. `169.254.169.254`), multicast and reserved ranges are rejected with 400 `VALIDATION_ERROR` (`field: "url"`) on create/update, and re-checked against the resolved IPs on every delivery. Test-mode endpoints may additionally use loopback (`localhost`, `127.0.0.1`, `::1`).
- **Delivery:** `POST url` with JSON body = the event object, hard timeout 8 s for the whole request. Redirects are **not** followed (a 3xx counts as a failure). At most 64 KB of the response is read. Deliveries are persisted with a lease, so after a restart pending/retrying deliveries are picked up by the job runner.
- **Headers:**
  - `Content-Type: application/json`
  - `User-Agent: OpenGateway-Webhooks/1.0`
  - `X-OpenGateway-Event: order.paid`
  - `X-OpenGateway-Event-Id: evt_...`
  - `X-OpenGateway-Delivery-Id: whd_...`
  - `X-OpenGateway-Signature: t=<unix>,v1=<hex HMAC_SHA256(secret, t + "." + rawBody)>`
- **Success:** any 2xx. Retries use backoff after attempts 1–6: 1m, 5m, 30m, 2h, 6h, 12h. After that the delivery is `failed`.
- **Delivery record:** `{ id, endpoint_id, event_id, event_type, status: "pending"|"success"|"failed", attempts, response_status, response_body (first 2 KB), duration_ms, next_attempt_at, created_at }`.

### Checkout signature (browser return)
On success, checkout redirects to `return_url?og_order_id=...&og_payment_id=...&og_status=paid&og_signature=...` (and posts the same fields via postMessage in modal mode).

- `og_signature = hex HMAC_SHA256(key_secret, order_id + "|" + payment_id)`.
- `key_secret` is the secret of the merchant's **current active API key for that mode**. Secrets are stored AES-256-GCM-encrypted with MASTER_KEY, so they can be used for signing.
- If the merchant has no active key, the signature is omitted.
- Failure, expiry or cancellation → `?og_order_id=...&og_status=failed|expired|cancelled`.

## Merchant REST API — `/v1` (HTTP Basic `key_id:key_secret`)

| Method & path | Body / query | Returns |
|---|---|---|
| `POST /v1/orders` | `amount` (int ≥100, ≤ 10000000), `currency?`, `receipt?`, `notes?` (≤15 keys), `customer?`, `expire_in?`, `return_url?`, `vpa_id?` (default VPA if omitted) | Order (201) |
| `GET /v1/orders` | filters `status`, `receipt` | collection |
| `GET /v1/orders/:id` | | Order |
| `GET /v1/orders/:id/payments` | | collection of Payment |
| `POST /v1/orders/:id/cancel` | | Order (only `created`/`attempted`; else 400 `ORDER_NOT_CANCELLABLE`) |
| `GET /v1/payments` / `GET /v1/payments/:id` | filter `status` | collection / Payment |
| `POST /v1/refunds` | `payment_id`, `amount?` (default full remaining), `notes?` | Refund (201) |
| `GET /v1/refunds` / `GET /v1/refunds/:id` | | |
| `POST /v1/payment_links` | `amount`, `description?`, `reference_id?`, `customer?`, `expire_by?` | Payment link (201) |
| `GET /v1/payment_links` / `GET /v1/payment_links/:id` / `POST /v1/payment_links/:id/cancel` | | |
| `POST /v1/test/orders/:id/simulate` | `{ "outcome": "success"|"failure" }`. Test keys only, else 403 `TEST_MODE_ONLY` | Order |

Errors: 401 `INVALID_API_KEY`, 400 `VALIDATION_ERROR` (with field), 404 `NOT_FOUND`, 409 `VPA_BUSY`, 400 `NO_VPA_CONFIGURED`.

## Observer ingest (public)

`POST /v1/observers/ingest`

**Auth:** header `X-Observer-Token: <token>`, or query `?token=` (many forwarder apps can only set a URL).

**Body:** accepts JSON or form-encoded, and is lenient:
- `text` | `message` | `msg` | `body` | `sms` (the SMS text),
- optional `from` | `sender`,
- optional `received_at`.

A raw `text/plain` body is also accepted.

**Server behaviour:**
1. Stores an **observation** `{ id, observer_id, mode (live, or test if the observer is a test observer), raw_text, sender, parsed: { direction:"credit"|"debit"|"unknown", amount (paise)|null, utr|null, payer_vpa|null }, status: "matched"|"unmatched"|"ignored"|"duplicate", order_id|null, created_at }`.
2. Ignores debits and texts with no amount (`ignored`).
3. Dedups by UTR, or by a hash of text+sender within 10 minutes (`duplicate`).
4. Matches against open orders (`created`/`attempted`, not expired, same merchant + mode):
   - If an observed UTR equals a payment's claimed UTR **and the credited amount is between that order's `amount` and `amount_payable`** → match.
   - Else, candidates are the orders whose `amount_payable == amount` that still hold their slot (open, or closed within the 15-minute grace window). Exactly one candidate is required. If it is open → match; if it expired within the grace window → match (late credit, the order becomes `paid`); if it is already paid or cancelled → `unmatched` (never re-attributed to another order).
   - On a match, capture: payment `captured` (`verified_by: "observer"`, `utr`), order `paid`, events fire.
   - With 0 or more than 1 candidates → `unmatched`, so the merchant can attach it manually.
   - A UTR already captured elsewhere (see above) → stays `unmatched`.
   - The whole ingest (dedup, insert, match, capture) runs in one `BEGIN IMMEDIATE` transaction; concurrent duplicates capture at most once.
5. Updates the observer's `last_seen_at`.

**Response:** `{ "ok": true, "observation_id": "...", "status": "matched", "order_id": "..." }`.

**Parser:** amount from `Rs`, `Rs.`, `INR` or `₹` patterns near credited/received/deposited, ignoring balance clauses (Avl Bal…). It errs toward `ignored`: failed/declined/pending/reversed transactions, refunds to you, mandates/AutoPay, collect requests, future-tense notices, OTPs, promotions (cashback, "win Rs 500", offers), and non-customer credits (loan, interest, salary, card bill payments) are never treated as credits. Only the first 4000 characters are parsed/stored. UTR = a 12-digit number near UTR, RRN, Ref or Txn. Payer VPA = `\S+@\S+`. A debit is detected by debited/sent/paid to/withdrawn. Write the parser from scratch, with unit tests covering HDFC, SBI, ICICI, Axis, Kotak and PhonePe/GPay notification styles.

## Public checkout API — `/api/checkout/:session` (no auth; session id is the capability)

| Method & path | Returns |
|---|---|
| `GET /api/checkout/:ps` | `{ order: {id, amount, amount_payable, currency, status, receipt, description, expires_at, customer}, merchant: {name, logo_url, brand_color, support_email, support_phone}, upi: {vpa, payee_name, uri}, payment: Payment|null, mode, return_url, server_time }`. Here `uri = upi://pay?pa=<vpa>&pn=<payee>&am=<rupees with 2dp>&cu=INR&tn=<order id or description>&tr=<order id>`. |
| `POST /api/checkout/:ps/attempt` | body `{flow:"qr"|"intent", upi_app?}` → creates (or returns the existing open) Payment, sets order `attempted`. 400 `ORDER_NOT_PAYABLE` if not open. |
| `POST /api/checkout/:ps/confirm` | body `{utr?}` (12 digits if given) → payment `pending_verification`, fires `payment.pending_verification`. Then immediately tries to match against `unmatched` credit observations **received after the order was created** (and within the last 30 min) that the observer matching rules above would attribute to exactly this order. The customer's UTR alone never captures. Returns `{ status, payment }`. |
| `GET /api/checkout/:ps/status` | `{ order_status, payment_status, redirect_url|null, expires_at, server_time }`. Clients poll every 2 s. `redirect_url` is built per the checkout-signature rules once terminal (paid/expired/cancelled/failed) and if `return_url` is set. |
| `POST /api/checkout/:ps/cancel` | order `cancelled`, payment `failed` (`USER_CANCELLED`) |
| `POST /api/checkout/:ps/simulate` | `{outcome:"success"|"failure"}`. Test-mode orders only. |
| `GET /api/public/links/:code` | `{ status, amount, description, merchant: {name, logo_url, brand_color} }` |

## Dashboard API — `/api/*` (cookie session)

**Auth:** `og_session` httpOnly cookie, SameSite=Lax, 7 days (`Secure` when `PUBLIC_URL` is https). Passwords use scrypt.

**CSRF:** state-changing requests (anything but GET/HEAD/OPTIONS) to `/api/auth/*` and the dashboard API are rejected with 403 `CSRF_REJECTED` when the browser says they are cross-site: an `Origin` header that is not `PUBLIC_URL`'s origin (or `http://localhost:5173` / `http://127.0.0.1:5173` outside production, or an `ALLOWED_ORIGINS` entry, or the server's own host), unless `Sec-Fetch-Site: same-origin`; or `Sec-Fetch-Site: cross-site|same-site` without an Origin. Requests with neither header (curl, scripts) are allowed. `/api/checkout/*` and `/api/public/*` are cookie-less and not checked.

**Login protection:** besides the per-IP limit, 10 failed logins for one email within 15 min lock that email for 15 min → 429 `ACCOUNT_LOCKED` with `Retry-After` (unknown emails behave identically). Login always issues a fresh session id.

| Endpoint | Notes |
|---|---|
| `POST /api/auth/signup` | `{name, email, password (≥8), business_name, phone}`. Creates the merchant, an owner user, default settings and a `test` API key (its secret is returned once in the response as `test_key: {key_id, key_secret}`). Sets the cookie. |
| `POST /api/auth/login` `{email,password}` / `POST /api/auth/logout` / `GET /api/auth/me` | `me` → `{ user:{id,name,email,role}, merchant:{id,business_name,onboarding_completed, live_enabled} }`. Logout deletes the session server-side. |
| `POST /api/auth/change-password` | **New.** `{current_password, new_password (≥8, ≤200)}` → `{ ok: true }`. Revokes **all** sessions of the user and sets a fresh cookie. Wrong current password → 400 `VALIDATION_ERROR` (`field: "current_password"`). |
| `GET /api/dashboard/summary?mode&range=today|7d|30d|90d` | `{ collected_amount, orders_count, paid_count, success_rate (0-100 float), pending_verification_count, unmatched_observations_count, refunds_amount, avg_ticket, series:[{date:"YYYY-MM-DD", amount, count}], recent_orders:[Order x8], method_split:[{upi_app, count, amount}] }` |
| `GET /api/orders?mode&status&q&from&to&count&skip` | `q` searches id, receipt, utr, customer phone/email. Collection. |
| `GET /api/orders/:id` | `{ order, payments:[], refunds:[], events:[], observations:[] }` |
| `POST /api/orders` | Dashboard "Create order / quick collect" `{amount, description?, customer?, expire_in?}` → Order (so the merchant can show a QR at a counter) |
| `POST /api/orders/:id/mark-paid` | `{utr?, note?}` → captures (`verified_by: "merchant"`). Allowed on open, expired and cancelled orders (the merchant is authoritative, e.g. the customer paid and then hit cancel). Already paid → 409 `ORDER_ALREADY_PAID`. |
| `POST /api/orders/:id/cancel` | |
| `POST /api/payments/:id/reject` | `{reason}` → payment `failed` (`MERCHANT_REJECTED`). The order goes back to `attempted` if not expired. |
| `GET /api/payments?mode&status&q` | collection |
| `GET /api/refunds?mode&status` / `POST /api/refunds {payment_id, amount, notes}` / `POST /api/refunds/:id/process {utr?}` / `POST /api/refunds/:id/fail` | |
| `GET/POST /api/payment-links`, `GET /api/payment-links/:id`, `POST /api/payment-links/:id/cancel` | |
| `GET/POST /api/vpas`, `PATCH /api/vpas/:id {label,payee_name,active,is_default}`, `DELETE /api/vpas/:id` | VPA `{id, mode, vpa, payee_name, label, is_default, active, created_at}`. Validate `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`. The first VPA in a mode becomes the default. |
| `GET /api/api-keys?mode` / `POST /api/api-keys {mode}` (returns `key_secret` once; making a new key deactivates the previous active key of that mode after confirmation in the UI) / `POST /api/api-keys/:id/revoke` | key `{id(key_id), mode, status:"active"|"revoked", created_at, last_used_at}` |
| `GET/POST /api/webhooks`, `PATCH /api/webhooks/:id`, `DELETE /api/webhooks/:id`, `POST /api/webhooks/:id/reveal-secret`, `POST /api/webhooks/:id/test` (sends a `ping` event), `GET /api/webhooks/:id/deliveries`, `POST /api/webhook-deliveries/:id/resend` | |
| `GET /api/events?mode&type` | collection of events |
| `GET/POST /api/observers` (`{name, mode}` → returns `{..., token, ingest_url: PUBLIC_URL + "/v1/observers/ingest?token=..."}`), `DELETE /api/observers/:id`, `POST /api/observers/:id/rotate-token` | observer `{id, name, mode, last_seen_at, active, created_at}` |
| `GET /api/observations?mode&status` / `POST /api/observations/:id/attach {order_id}` / `POST /api/observations/:id/ignore` / `POST /api/observers/test-parse {text}` → parsed result (UI "try a sample SMS") | Attach works on `unmatched` or `ignored` (non-debit) observations, to an order of the same mode in any state except `paid` (cancelled/expired included). |
| `GET /api/settings` / `PATCH /api/settings` | `{ business_name, business_type, phone, support_email, support_phone, website, logo_url, brand_color (hex), order_expiry_seconds, unique_amount, onboarding_completed }`. `logo_url`/`website` must be http(s); `brand_color` must be `#rgb`/`#rrggbb`; phones must match `^\+?[0-9\- ]{6,20}$`. |
| `GET /api/team` / `POST /api/team {name,email,role,password}` / `PATCH /api/team/:id {role}` / `DELETE /api/team/:id` | roles `owner|admin|developer|viewer`. Viewer can only GET. Developer can't manage team or refunds. |
| `GET /api/reports/export?mode&type=orders|payments|refunds&from&to` | `text/csv` download |
| `GET /api/api-logs?mode` | last 500 `/v1` requests `{id, method, path, status, duration_ms, key_id, created_at}` |
| `POST /api/live/enable` | Requires ≥1 live VPA and business details. Sets `live_enabled`. |

## Checkout SDK — `/checkout.js`

```html
<script src="https://YOUR_GATEWAY/checkout.js"></script>
<script>
  const og = new OpenGateway({
    session_id: order.payment_session_id,   // from POST /v1/orders
    mode: "modal",                            // or "redirect"
    onSuccess: (r) => {/* {order_id, payment_id, signature} */},
    onFailure: (r) => {/* {order_id, status} */},
    onClose: () => {}
  });
  og.open();
</script>
```

- **Modal:** a full-screen overlay with an iframe of `/pay/:ps?embed=1`. The iframe posts `{source:"opengateway", type:"success"|"failure"|"close", ...}` to the parent.
- **Redirect:** `location = checkout_url`.

## Web app routes (`web/`)

| Route | Content |
|---|---|
| `/` | Marketing landing page |
| `/login`, `/signup` | Auth |
| `/onboarding` | Wizard |
| `/docs` | Developer docs |
| `/pay/:ps` | Hosted checkout |
| `/link-status/:code` | Payment-link status |
| `/dashboard` | Home |
| `/dashboard/orders`, `/dashboard/orders/:id` | Orders |
| `/dashboard/payments` | Payments |
| `/dashboard/refunds` | Refunds |
| `/dashboard/payment-links` | Payment links |
| `/dashboard/quick-collect` | Quick collect |
| `/dashboard/verification` | Observers + unmatched credits |
| `/dashboard/reports` | Reports |
| `/dashboard/developers/api-keys`, `/dashboard/developers/webhooks`, `/dashboard/developers/events`, `/dashboard/developers/logs` | Developers |
| `/dashboard/settings/business`, `/dashboard/settings/upi`, `/dashboard/settings/checkout`, `/dashboard/settings/team` | Settings |

Brand: "OpenGateway", primary color PhonePe-like purple `#5f259f`.

## Security headers (server)

- All responses: `X-Content-Type-Options: nosniff` (+ HSTS when `PUBLIC_URL` is https).
- `/api/*`, `/v1/*`, `/health`: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`.
- `/pay/*` (hosted checkout): may be framed by any merchant site (`frame-ancestors *`, no `X-Frame-Options`), `Referrer-Policy: no-referrer` (the URL is a capability).
- Every other page (SPA): `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP of `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: http:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`. The web app must not rely on inline scripts or third-party script/connect origins.
