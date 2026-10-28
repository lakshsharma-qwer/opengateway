# opengateway Knowledge Base: Indian Payment Gateways

Researched 2026-10-23 from official docs. Facts that couldn't be confirmed are marked `(unverified)` inside each file. Re-check those before relying on them.

| File | Gateway | Lines | Primary source |
|---|---|---|---|
| [razorpay.md](razorpay.md) | Razorpay | ~1,100 | razorpay.com/docs (full llms.txt markdown dump, Apr 2026) and the pricing page |
| [cashfree.md](cashfree.md) | Cashfree Payments | ~1,160 | cashfree.com/docs plus the OpenAPI spec `v2026-01-01.yaml` |
| [phonepe.md](phonepe.md) | PhonePe PG | ~1,420 | developer.phonepe.com (v2). v1 is legacy, taken from snippets and community code |

Each file covers products, onboarding/KYC, every dashboard section with its buttons, checkout UX, the end-to-end flow, the API reference, webhooks, errors/limits/idempotency, refunds/settlements/disputes, pricing/SDKs and security. Each ends with a **Design Takeaways for opengateway** section.

## Where to look

| Topic | Razorpay | Cashfree | PhonePe |
|---|---|---|---|
| Products | §1 | §1 | §1, §10–12 |
| Onboarding / KYC / keys | §2 | §2 | §2 |
| Dashboard (buttons, filters) | §3 | §3 | §3 |
| Checkout UX | §4 | §4 | §4, §7, §8 |
| End-to-end flow | §5 | §5 | §5 (v2), §6 (v1) |
| API reference | §6 | §6 | §5–7 |
| Webhooks | §7 | §7 | §9 |
| Errors / rate limits / idempotency | §8 | §8 | §13 |
| Refunds / settlements / disputes | §9 | §9 | §14 |
| Pricing / SDKs / security | §10–11 | §10 | §15–17 |
| Test data / sandbox | §2 | §11 | §2 |
| Design takeaways | §12 | §11 | §18 |

## Cross-gateway comparison

| Concern | Razorpay | Cashfree | PhonePe PG (v2) |
|---|---|---|---|
| **Server auth** | HTTP Basic `key_id:key_secret` | Headers `x-client-id`, `x-client-secret`, `x-api-version` | OAuth client_credentials → `Authorization: O-Bearer <token>` (v1: `X-VERIFY` = SHA256(base64payload + path + salt) + `###` + saltIndex) |
| **API versioning** | Path `/v1` | Date header (`2026-01-01` is latest) | Path (`/checkout/v2/...`) |
| **Core object** | Order → Payments | Order → `payment_session_id` → Payments | Order (`merchantOrderId`) → `paymentDetails[]` attempts |
| **Order states** | `created → attempted → paid` | `ACTIVE → PAID / EXPIRED / TERMINATED` | `PENDING → COMPLETED / FAILED` |
| **Payment states** | `created → authorized → captured → refunded`, or `failed` | `SUCCESS / FAILED / PENDING / USER_DROPPED / CANCELLED / ...` | Attempt-level states. The root `state` is the source of truth |
| **Auth/capture** | Auto or manual capture (window min 12 min, default 3 days) | Pre-auth supported (authorize/capture/void) | Single-step in Standard Checkout |
| **Browser trust** | Checkout returns `razorpay_signature` = HMAC_SHA256(secret, `order_id\|payment_id`) | No client signature. Merchant calls Get Order on `return_url` | `CONCLUDED`/`USER_CANCEL` callback only. Merchant must call the Status API |
| **Status reconciliation** | Webhooks + fetch | Webhooks + Get Order/Payments | Webhooks + mandated polling (20–25 s, then 3/6/10/30/60 s) |
| **Webhook signing** | `X-Razorpay-Signature` = HMAC-SHA256(raw body), per-endpoint secret | `x-webhook-signature` = base64 HMAC-SHA256(timestamp + rawBody) + `x-webhook-timestamp` | `Authorization` = SHA256(`username:password`). Static, doesn't sign the body |
| **Webhook retries** | Exponential for 24 h, then auto-disable. `x-razorpay-event-id` for dedup | Configurable retry policies, logs UI, batch resend | Not published |
| **Idempotency** | Headers on refunds/transfers/payouts (payouts mandatory) | `x-idempotency-key` + natural keys | Merchant-supplied IDs (duplicates return an error) |
| **Error envelope** | `{error:{code, description, source, step, reason, field, metadata}}` | `{message, code, type, help}` | `{code, message, context}` (see §13) |
| **Pagination** | `count/skip/from/to`, max 100 | Cursor-based on list endpoints | Limited list APIs |
| **Default settlement** | T+2 (instant/on-demand at extra cost) | T+2 (instant/on-demand available) | T+1 |
| **Refund window** | 6 months (unverified for some methods) | 6 months | 90 days |
| **Sandbox magic values** | `success@razorpay`/`failure@razorpay`, test cards, mock bank page | `testsuccess@gocash` + 20 failure VPAs, OTP `111000`, `/simulate` APIs | `success@ybl`/`failed@`/`pending@`, OTP `123456`, simulator templates |
| **Headline MDR** | ~2% (domestic) | ~1.95% | 1.99% (promo: free) |

**Industry fact (from the Razorpay research):** NPCI deprecated UPI Collect from **28 Feb 2026**, with limited exemptions. Build UPI as **Intent + QR** first.

## Synthesised blueprint for opengateway

This picks the best pattern from each gateway.

1. **Resources:** `Order` (amount locked server-side, merchant `receipt`/natural key) → many `Payment` attempts → `Refund`s. Plus `Settlement`, `Dispute`, `Customer`, `Token`, `PaymentLink`, `WebhookEndpoint`, `Event`.
2. **IDs:** prefixed base62 (`order_`, `pay_`, `rfnd_`, `setl_`, `disp_`, `evt_`). Every object has `entity` and `created_at`. Lists are `{entity:"collection", count, items, cursor}`.
3. **Two clocks per order** (Cashfree): `expires_at` for starting an attempt and an attempt TTL. A late success after expiry gets an auto-refund.
4. **Two-phase payments** (Razorpay): `created → authorized → captured`, with auto-capture by default, manual capture optional, and auto-refund of stale authorizations.
5. **Browser handoff:** an opaque short-lived `payment_session_id` (Cashfree) plus a signed client return (`HMAC(order_id|payment_id)`, Razorpay). The docs still tell merchants to verify server-side.
6. **Auth:** API keys (Basic) for simplicity. Optionally OAuth client-credentials with key versioning for rotation (PhonePe v2). Separate test and live key pairs with fully isolated data.
7. **Versioning:** date-based `X-Api-Version` header, with webhook versions pinned per endpoint (Cashfree).
8. **Webhooks:** `{id, type, created_at, data}` envelope. Signature = HMAC-SHA256 over `timestamp.rawBody` with a replay window. Event-ID header for dedup. At-least-once delivery, exponential retries for 24 h, then auto-disable with an alert. Delivery logs, manual replay and batch resend.
9. **Idempotency:** `Idempotency-Key` header on every POST. Same key with a different body → 409. A replay returns the original response with an `Idempotent-Replayed: true` header.
10. **Errors:** `{error:{type, code, reason, message, field, source, step, docs_url}}` with a small, closed `type` set and a stable `reason` enum.
11. **Rate limits:** `RateLimit-*` headers on every response (Cashfree) and 429 with `Retry-After`.
12. **UPI first:** Intent, QR and an S2S `next_action` protocol (`redirect`, `otp_submit`, `upi_intent`, `poll`). Publish a recommended polling schedule (PhonePe).
13. **Dashboard IA:** Home (balances, KPIs) · Transactions (Payments, Orders, Refunds, Disputes) · Settlements (UTR drawer, recon export) · Payment Products (Links, Pages, Buttons, QR, Subscriptions) · Customers · Reports (async, scheduled) · Developers (API keys, Webhooks, API/webhook logs, Rate limits, Whitelisting) · Settings (Payment methods, Checkout branding, Bank account, Team and RBAC, 2FA) · a Test/Live toggle in the header.
14. **Sandbox:** magic VPAs and cards for every outcome, a mock bank/OTP page, and `/simulate` endpoints for payments, settlements and disputes.
