# Cashfree Payments (India): Reference Knowledge for opengateway

> **Date researched:** 2026-10-23
> **Purpose:** A reference for building "opengateway", an open-source payment gateway modeled on Razorpay, PhonePe PG and Cashfree. This file records how Cashfree Payment Gateway (PG) actually works: its products, dashboard, checkout, APIs, webhooks, statuses, errors, limits and pricing.
> **Latest PG API version as of this date:** `x-api-version: 2026-01-01`. Earlier versions still served: `2025-01-01`, `2023-08-01`, `2022-09-01` (plus older ones for subscriptions: `2022-01-01`, `2021-05-21`).
> **Convention:** Anything marked **(unverified)** came from general knowledge or a secondary source and was not confirmed against an official Cashfree page during this research. Everything else came from Cashfree's docs or OpenAPI spec.

## Sources

Primary (official):
- OpenAPI spec, PG v2026-01-01 (the source of truth for endpoints and enums): https://www.cashfree.com/docs/openapi/payments/v2026-01-01.yaml (older: `v2025-01-01.yaml`, `v2023-08-01.yaml`, `v2022-09-01.yaml`)
- Docs index for LLMs: https://www.cashfree.com/docs/llms.txt, https://www.cashfree.com/docs/_llms/payments.txt, https://www.cashfree.com/docs/_llms/payments-apis.txt
- Create Order: https://www.cashfree.com/docs/api-reference/payments/latest/orders/create
- Order Pay: https://www.cashfree.com/docs/api-reference/payments/latest/payments/pay
- Get Payments for an Order: https://www.cashfree.com/docs/api-reference/payments/latest/payments/get-payments-for-an-order
- Create Refund: https://www.cashfree.com/docs/api-reference/payments/latest/refunds/create
- Authentication: https://www.cashfree.com/docs/api-reference/authentication.md
- Errors: https://www.cashfree.com/docs/api-reference/payments/errors.md
- Rate limits: https://www.cashfree.com/docs/api-reference/payments/rate-limits.md and https://www.cashfree.com/docs/api-reference/rate-limits.md
- Webhooks: https://www.cashfree.com/docs/payments/online/webhooks/overview, https://www.cashfree.com/docs/api-reference/payments/latest/webhooks/overview.md, https://www.cashfree.com/docs/api-reference/webhooks/payloads-and-signatures.md, https://www.cashfree.com/docs/api-reference/webhooks/events-by-product.md, https://www.cashfree.com/docs/payments/online/webhooks/configure.md, https://www.cashfree.com/docs/api-reference/payments/latest/webhooks/idempotency.md
- Event-specific webhooks: `.../latest/payments/webhooks.md`, `.../latest/refunds/webhooks.md`, `.../latest/settlements/settlement-webhooks.md`, `.../latest/disputes/dispute-webhooks.md`, `.../latest/payment-links/webhooks.md`, `.../latest/subscription/webhooks.md`, `.../latest/token-vault/webhooks.md`, `.../latest/split/webhooks/*.md` (all under https://www.cashfree.com/docs/api-reference/payments)
- Web dashboard: https://www.cashfree.com/docs/payments/dashboard.md
- Payment lifecycle (order expiry, TTL, states): https://www.cashfree.com/docs/payments/online/resources/payment-lifecycle.md
- Web checkout (JS SDK v3): https://www.cashfree.com/docs/payments/online/web/redirect.md
- Elements: https://www.cashfree.com/docs/payments/online/element/introduction.md, `.../element/overview.md`, `.../element/cards.md`, `.../element/upi.md`, `.../element/other-components.md`
- Whitelisting: https://www.cashfree.com/docs/payments/online/go-live/whitelist.md
- Go-live checklist: https://www.cashfree.com/docs/payments/online/go-live/checklist.md
- API logs: https://www.cashfree.com/docs/payments/online/go-live/api-logs.md
- Refunds: https://www.cashfree.com/docs/payments/manage/refunds/overview.md, `.../refunds/instant-refunds.md`
- Settlements: https://www.cashfree.com/docs/payments/manage/settlements.md
- Disputes: https://www.cashfree.com/docs/payments/manage/disputes/disputes-states.md, `disputes-types.md`, `disputes-process-flow.md`, `dashboard-actions.md`
- Account activation (KYC): https://www.cashfree.com/docs/help/account/account-activation.md
- Access management (roles): https://www.cashfree.com/docs/help/account/access-management.md
- Payment links: https://www.cashfree.com/docs/payments/no-code/payment-link.md
- Subscriptions: https://www.cashfree.com/docs/api-reference/payments/latest/subscription/overview.md, https://www.cashfree.com/docs/payments/subscription/introduction.md
- Easy Split: https://www.cashfree.com/docs/payments/split/overview.md
- VBA: https://www.cashfree.com/docs/payments/vba/overview.md
- Test data: https://www.cashfree.com/docs/api-reference/payments/data-to-test-integration.md
- Server SDKs: https://www.cashfree.com/docs/api-reference/payments/sdk.md
- Payment methods: https://www.cashfree.com/docs/payments/manage/payment-methods/overview.md
- Checkout customization: https://www.cashfree.com/docs/payments/checkout/customise-checkout.md
- Pricing: https://www.cashfree.com/payment-gateway-charges/
- Payouts v2 API index: https://www.cashfree.com/docs/api-reference/payouts/v2/overview.md

---

## Table of contents

1. Product overview
2. Merchant onboarding, KYC, environments, credentials, whitelisting
3. Merchant dashboard walkthrough
4. Checkout UX: hosted, JS SDK v3, Elements, S2S, mobile SDKs, payment methods
5. End-to-end integration flow (with JSON)
6. API reference (all PG endpoints, entities, lifecycles)
7. Webhooks
8. Errors, rate limits, idempotency, pagination
9. Refunds, settlements, disputes
10. Pricing, SDKs, plugins, security and compliance
11. Takeaways for opengateway

---

## 1. Product overview

Cashfree Payments is an RBI-authorised Payment Aggregator (PA) based in Bengaluru. It has three main product families, and each has **its own API keys**:

| Family | Keys | Products |
|---|---|---|
| **Payment Gateway (collections)** | PG App ID + Secret (one pair at a time) | Payment Gateway, Payment Links, Payment Forms, Payment Buttons, Subscriptions, Easy Split, Virtual Bank Accounts (PG VBA, formerly Auto Collect), Offers/EMI, One Click Checkout, softPOS, BBPS Billers, UPI Reserve Pay, International (IPG, Global Collections, Collect-from-India), RiskShield, flowWise |
| **Payouts** | Payouts/Secure ID keys (up to 10, shared) | Payouts (bank/UPI/card/wallet transfers), Cashgram, Connected BaaS |
| **Secure ID (verification)** | Same keys as Payouts | PAN, Aadhaar, bank account (penny drop and reverse penny drop), IFSC, GSTIN, Video KYC, e-Sign, KYC links |

### 1.1 Product catalog

| Product | What it does | Key API / notes |
|---|---|---|
| **Payment Gateway** | Online checkout across 120+ methods: cards, UPI, netbanking, wallets, EMI, pay later, bank transfer, Apple Pay, PayPal | `POST /pg/orders` → `payment_session_id` → checkout |
| **Payment Links** | Shareable link (SMS, email, WhatsApp) with optional partial payments, auto reminders, expiry, and UPI-only mode | `POST /pg/links`. Statuses: ACTIVE, PAID, PARTIALLY_PAID, EXPIRED, CANCELLED |
| **Payment Forms** | No-code hosted form pages with custom fields, fixed or variable amounts, and a subscription form variant | Webhook `PAYMENT_FORM_ORDER_WEBHOOK` |
| **Payment Buttons** | Embeddable pay button for websites | Dashboard only |
| **Subscriptions** | Recurring payments via UPI Autopay, eNACH, physical NACH, card SI. PERIODIC or ON_DEMAND plans | `/pg/plans`, `/pg/subscriptions`, `/pg/subscriptions/pay` |
| **Easy Split** | Marketplace splits: vendor onboarding with KYC, order-level splits, split after payment, static split, on-demand vendor transfers, adjustments, vendor settlements | `/pg/easy-split/*`, `order_splits` on orders |
| **Virtual Bank Accounts (VBA, formerly Auto Collect)** | Unique account number and IFSC (AXIS, ICICI, YES) per customer for NEFT/RTGS/IMPS, with auto-reconciliation. Optional TPV auto-rejects unexpected remitters | Webhook `VBA_TRANSFER_SUCCESS_PAYMENT`. Simulate via `POST /pg/simulate` with entity `VBA_TRANSFER` |
| **Offers / EMI** | Merchant-created offers (DISCOUNT, CASHBACK, DISCOUNT_AND_CASHBACK, NO_COST_EMI), card EMI, cardless EMI, pay later | `/pg/offers`, `/pg/eligibility/*` |
| **One Click Checkout** | Shopify, WooCommerce and custom one-click checkout with saved addresses, COD controls, RTO and shipping, abandoned cart recovery | `products.one_click_checkout` in Create Order |
| **softPOS** | Card-on-phone (tap) acceptance, terminals, soundbox VPA, static QR | `/pg/terminal/*` |
| **Instant / On-Demand Settlements** | Settlement within about 15 minutes, or on demand 24x7 including holidays, for a fee | Dashboard: Settlements > On-Demand |
| **International payments (IPG)** | 140+ currencies on international cards, plus PayPal | Also Global Collections (inward via collection accounts) and "Collect from India" (import payments) |
| **Token Vault** | Network tokenisation of saved cards (RBI CoF rules), cryptogram fetch | `/pg/customers/{id}/instruments` |
| **Preauthorisation** | Card and UPI pre-auth with later CAPTURE or VOID | `POST /pg/orders/{order_id}/authorization` |
| **TPV (third-party validation)** | Restrict payment to a registered bank account (common for securities and NBFCs) | `customer_bank_account_number`, `customer_bank_ifsc`, `customer_bank_code` |
| **RiskShield** | ML fraud scoring, smart rules, custom block/allow lists, flagged payments (`FLAGGED` state) | Dashboard |
| **flowWise** | Payment routing and orchestration across multiple PGs | Dashboard (details unverified) |
| **Downtime / Incidents** | Bank and method downtime feed | `GET /pg/incident`, Incident webhook |
| **BBPS Billers** | Collect bills through the Bharat Bill Payment System | Separate onboarding |
| **UPI Reserve Pay** | Block funds once, then debit multiple times (UPI single-block-multi-debit) | `payment_group: sbc_upi` appears in webhooks |
| **Payouts** | Disburse to bank, UPI, card or wallet. v2 base `https://api.cashfree.com/payout` (sandbox `https://sandbox.cashfree.com/payout`), `POST /transfers` | Events: TRANSFER_SUCCESS, TRANSFER_FAILED, TRANSFER_REVERSED, TRANSFER_REJECTED, TRANSFER_ACKNOWLEDGED, BULK_TRANSFER_REJECTED, BENEFICIARY_INCIDENT, CREDIT_CONFIRMATION, LOW_BALANCE_ALERT |
| **Cashgram** | Payout link: the recipient enters their own bank or UPI details to redeem | Events CASHGRAM_REDEEMED, CASHGRAM_TRANSFER_REVERSAL, CASHGRAM_EXPIRED. Form-encoded webhooks |
| **Secure ID** | KYC/KYB verification APIs, Video KYC, e-Sign | Events VKYC_*, BANK_ACCOUNT_VERIFICATION_*, RPD_* |
| **PPI wallet** | Prepaid instrument (closed or gift wallet) APIs | `PPI_CREDIT_SUCCESS` |

---

## 2. Merchant onboarding, KYC, environments, credentials, whitelisting

### 2.1 Sign-up and activation flow (dashboard)

1. **Sign up** at `merchant.cashfree.com/merchants/signup` with business email and password (or Google), then verify mobile by OTP. There is an optional WhatsApp opt-in.
2. **Business details:** brand name, product or service category, annual turnover range.
3. **Choose your solution:** "Collect Payments" (needs website URL or Play Store / App Store URL), "Verify My Customers", or "Make Payouts". The last two require a business PAN.
4. **KYC information:**
   - Enter the business PAN. The system fetches the legal name and GST/CIN/LLPIN.
   - **Archetype detection:** the 4th character of the PAN is "P" for an individual or proprietor. Any other character means a registered entity (for example "C" for a company).
   - **Individual or proprietor:** verify the owner by Aadhaar OTP, DigiLocker, or CKYC (mobile plus OTP linked to the PAN's CKYC record). Upload at least **two** proofs of business (Udyam, Shop & Establishment, MSME, municipal certificate, Udyog Aadhaar). Without them, the business type becomes "Unregistered".
   - **Registered entity:** authorised signatory verification, with the CKYC record auto-fetched using PAN plus date of incorporation. Then **Beneficial Owner** confirmation: >10% ownership in a company, partnership or LLP; >15% in an association, BOI or society; >=10% interest in a trust. Once confirmed, the list is frozen.
   - Principal place of business, which may be physically verified.
   - Entity-specific documents (varying by line of business and MCC).
5. **Bank account setup:** account number and IFSC, then **Verify** (penny drop).
6. **Video KYC (V-CIP)**, only if Enhanced Due Diligence (EDD) fails. EDD covers address verification, website and PAN checks, a first-transaction-from-KYC'd-account check, and email and phone trails.
7. **Submit to verify.** Activation typically takes **24 working hours** after all documents are in.

Identity methods: Aadhaar OTP (most common), CKYC (must be attempted for individuals), DigiLocker, and manual certified copies of an original valid document.

### 2.2 Environments

| | Sandbox / Test | Production |
|---|---|---|
| PG API base | `https://sandbox.cashfree.com/pg` | `https://api.cashfree.com/pg` |
| Payouts base | `https://sandbox.cashfree.com/payout` | `https://api.cashfree.com/payout` |
| JS SDK mode | `Cashfree({mode:"sandbox"})` | `Cashfree({mode:"production"})` |
| Dashboard | **Switch to Test** toggle (top right). A yellow banner shows test mode | **Switch to Prod** |
| API keys | Auto-generated for PG | Generated after activation, with 2FA |
| Webhook URL | http or https allowed | https only |
| Not supported in sandbox | PayPal, bank transfer | n/a |

### 2.3 API credentials

| Credential | Aliases | Header | Who |
|---|---|---|---|
| App ID | Client ID, `appId`, `CASHFREE_APP_ID` | `x-client-id` | All merchants |
| Secret Key | Client secret, `secretKey`, `CASHFREE_SECRET_KEY` | `x-client-secret` | All merchants |
| Partner API key | `CASHFREE_PARTNER_API_KEY` | `x-partner-apikey` | Embedded partners |
| Partner merchant ID | n/a | `x-partner-merchantid` | Partners acting for a sub-merchant |
| Client signature | n/a | `x-client-signature` | Signature-based alternative to the secret (RSA public-key flow, typically used with Payouts / Secure ID; details unverified for PG) |
| OAuth client ID / secret | n/a | n/a | Software partners using OAuth |

Accepted auth header combinations on PG endpoints: (`x-client-id` + `x-client-secret`), (`x-client-id` + `x-partner-apikey`), (`x-client-id` + `x-client-signature`), (`x-partner-merchantid` + `x-partner-apikey`).

Key rules:
- PG keys and Payouts/Secure ID keys are **not interchangeable**.
- PG allows **one key pair at a time**. Payouts and Secure ID allow **up to 10** keys, shared between both.
- Generate keys under **Developers > API Keys > Generate API Keys**. Production requires 2FA, and so does **View API Key**. Allowed roles: Owner, Admin, Developer.
- Never call authenticated APIs from the client. The exception is `/orders/sessions` (Order Pay), which is authenticated by `payment_session_id` alone.
- If you rotate the secret, keep the old one working until in-flight webhooks signed with it have been processed.

### 2.4 Domain and app whitelisting (required before checkout works in production)

Dashboard path: **Developers > Whitelisting > Add New**. Choose the type **Website URL** or **App Link**.
- Site requirements: Contact Us, Terms and Conditions, and Refunds and Cancellations pages; products listed; prices in INR.
- URL rules: only `https://`. A trailing slash and paths are OK. No custom ports, no sandbox hosts, no bare domains, no `http`.
- Apps: official Play Store or App Store listing URL only, with no tracking parameters. Package-name entries need no trailing slash and take up to 60 minutes to become active.
- The new domain's line of business must match the account's. A different LOB needs a new account.
- Review takes about 24 hours.
- Calls from a domain that isn't whitelisted fail with error codes like `domain_name_refererString` or `android_package_{xRequestedWith}`.

### 2.5 IP whitelisting

The dashboard has an IP allow-list under **Developers > Whitelisting** that restricts which addresses can call the API. Payouts and Secure ID enforce IP whitelisting, or require the `x-cf-signature` / public-key signature as an alternative. For PG it is optional. (The exact PG IP-whitelisting UI is only partially verified.)

---

## 3. Merchant dashboard walkthrough

URL: `merchant.cashfree.com`. From home, choose **Payment Gateway > Access**. The left-nav sections below are listed in the order the official "Web Dashboard" doc gives. A mobile dashboard app also exists.

### 3.1 Summary
- **Overview**
  - Cards: Recent Settled Amount (Online and Offline, with dates), Open Disputes (Action Required vs Under Review, by amount and count), Risky Transactions (RiskShield Blocked vs Flagged for Review).
  - Charts over a selectable range (for example, last 7 days): Total Transactions, Total Refunds, Average Transaction Value, Preferred Payment Methods (pie).
- **Analytics** has three tabs:
  - **Business trends:** success rate by mode (Bank Transfer, UPI, NB, Card, Wallet) and number of transactions compared with the prior period.
  - **Conversion rate:** payment funnel (Orders created → Payment attempted → Paid orders), conversion gauge, unique vs repeat customers, Auto Retry stats ("Number of Auto Retry Transactions", "Successful Transactions after Auto Retry").
  - **Payment failure:** failure timeline, average failures by source (Customer vs Bank), Top Failure Reasons table (description, rate, source, mode).

### 3.2 Transactions
| Sub-page | Columns | Actions and filters |
|---|---|---|
| **Payments** | Date & Time, Transaction ID (cf_payment_id), Transaction Amt, Payment Method, Status (Success, Failed, User Dropped, ...), Customer Phone, Order ID, Order Amt, Customer Ref ID | Date range, Search & Filter (order ID, txn ID, status, mode), export/download. **Refund** button on successful rows: enter amount (full or partial), remark, refund speed (standard or instant, with fee info icon), then **Initiate Refund**. The refund option appears only for successful (settled) txns |
| **Orders** | Date & Time, Order ID, Order Amount, CF Order ID, Order Type (product: PG, Links, Forms...), Integration Type, Customer Name, Phone, Email, Status (Paid, Expired, Pending/Active) | Search, filter, export |
| **Refunds** | Tabs: **Initiated Refunds**, **Batch Refunds**, **Auto Refunds**. Columns: Date & Time, Order ID, Refund Amt, Order Amt, CF Refund ID, Refund ARN, Payment Mode, Refund Speed (Normal or Instant), Status (Onhold, Success, Failed, Pending, Cancelled) | **Batch Refunds > Upload File**: download sample CSV, read the instructions, upload. Format errors are shown for fixing |
| **Disputes** | Tabs: **Action Required** (summary cards: Due Today, Due Tomorrow, Insufficient Evidence), **Under Review**, **Closed** (cards: Won, Lost, Accepted), **All Disputes**. Columns: Updated On, Created On, Dispute ID, Order ID, Transaction ID, Type, Dispute Amt, Respond By, Action | **Take Action** opens a popup with **Accept Dispute** (with remarks) or **Contest Dispute and Submit Evidence**. **Upload Evidence** appears when evidence is insufficient. **Upload More Evidence** is available Under Review. The detail page shows timeline, details, and **Message Cashfree** |
| **Suspicious Transactions** | Created On, Order ID, Transaction ID, Suspicious Amt, Case ID, Status (Under Review, Cleared, Blocked) | Investigate, approve, or reject flagged payments |

### 3.3 Settlements
- Tabs: **Online Settlements** and **Offline Settlements** (softPOS). Plus **On-Demand** (with **Request Activation** and **Settle Now** buttons) and **Vendor** settlements (Easy Split).
- Summary cards: **Unsettled Amount** (shows the current cycle, for example "2 working days") and **Upcoming Settlement** (amount and expected date).
- **Standard** table: Initiated At, Transaction Period, UTR, Settled Amt, Status (Processed, Skipped, Pending). Click a row for the per-transaction breakdown.
- **Vendor** table: Date & Time, Period, Type (AUTOM or MANUAL), Vendor ID, Settlement ID, UTR No., Adjustment Amt, Settled Amt, Status (SUCCESS or FAILED), Failure Reason.
- **View Settlement Holidays** button (top right), based on the RBI Mumbai holiday list.
- Bank account management lives under **Settings > Bank Accounts**.

### 3.4 Virtual Bank Account configuration
- **VBA Accounts:** cards showing Virtual ID, Name, Status (Active or Inactive), A/c, IFSC. **Create VBA Account** button.
- **Notification Groups:** groups that receive WhatsApp and email alerts on VBA credits. **Create Notification Group** button.

### 3.5 Payment Links
- **All Payment Links:** **Create Payment Link**, a date dropdown (for example Last Month), Search & Filter, and rows per page (default 10). Columns: Created At, Created By, Link ID, CF Link ID, Amount, Phone, Email, Link Type (for example "One-time (All methods)"), Status (Active, Paid, Partially Paid, Expired, Cancelled). Row actions: view, edit (expiry and so on), cancel, resend reminder.
- **Create Payment Link form:**
  1. Type: **All payment methods** or **Only UPI**.
  2. Payment reason.
  3. Currency and amount; **Allow partial payment** toggle with a minimum amount.
  4. Customer phone (required), with **Send SMS** and **Send WhatsApp** checkboxes.
  5. Email (optional) and Name (optional).
  6. **Create & Send**.
  - Advanced options: expiry, notes, auto reminders, batch link upload (unverified UI detail).
- **Orders** (orders created via links): Date & Time, Order ID (format `CFPay_<linkhash>_<random>`), Transaction ID, CF Link ID, Link ID, Amount, Phone, Email, Status.

### 3.6 Apps
Ecommerce Apps (Shopify, Shopify Onsite Card Payments), Software Vendors (ISVs, with **Connect** and **Disconnect**), Other Apps (Slack notifications).

### 3.7 Customers
- **Active:** Phone, Latest Email, Total Spends, Total Paid Txns, Last Transacted At, Preferred Mode, Tags.
- **Unfulfilled:** customers with attempts but no success. Columns: Phone, Latest Email, Potential Spends, Total Unpaid Txns, Last Attempted At.

### 3.8 Payment Gateway products
Tiles for One Click Checkout, Easy Split, Payment Forms, Payment Buttons, SoftPOS (Collection Point management and payment methods config), and flowWise.
- **Payment Forms (unverified UI detail):** create a form with a title, description, logo and theme, fixed or customer-entered amount fields, custom input fields, and a share link. Each form has an orders list.
- **Subscriptions (separate product dashboard):** Plans (create plan), Subscriptions (create subscription or mandate link; statuses), Payments (charges, retries), Refunds.

### 3.9 RiskShield
Overview, Risky Transactions (risk scores and reasons), Smart Rules (automated rules with effectiveness tracking), Custom Lists (blacklists and allowlists of customers, methods and other parameters).

### 3.10 Reports
- **Download Reports:** choose a date range and report type (payments, refunds, settlements, settlement recon, disputes, etc.), then download.
- **Schedule Reports:** daily, weekly or monthly automated delivery.

### 3.11 Developers
| Page | What it does |
|---|---|
| **API Keys** | Generate or view (2FA) the App ID and Secret. One active pair for PG |
| **API Logs and Alerts** | **Logs** tab: every API call, errors grouped by endpoint with counts and messages (for example `risk_data.customer_ip is Invalid...`). **Alerts** tab: rules with Rule Name, Rule Type (API Alert or Rate Limit Warning), Grouping (All APIs or Selected API), Severity (Low, Medium, High), Threshold (Error %, Time Window, Min Sample Size, Self-Resolve Time, Resolve Wait Time). Actions: Test, Edit, Status. Alerts go to the configured communication recipients |
| **Webhooks** | **Webhook Endpoints** list (URL, Version, Events, Actions: Test, Edit, Disable, Delete). **Add Webhook Endpoint** flow: URL, version dropdown, **Test**, then choose events, then **Add Webhook**. Retry policy editor. **Logs** (Success and Failed tabs; filters by date, URL, type; detail shows message, time, version, headers, payload; **Batch Resend** for payment webhooks by txn IDs, file, or time window up to 24h). **Analytics** (success rate: Total Attempts, Successful, Retried Successful, Failed; latency) |
| **Rate Limits** | Per-API view of Rate Limit, Latest Usage, Average Usage, Burst limit, Request Count, Violation Count. **Request new limit** (rate or burst, plus reason), approved in 1-2 business days |
| **Whitelisting** | Domain and app whitelisting requests with status. IP whitelisting |
| **Checkout Analytics** | One Click Checkout events and funnels |

### 3.12 Downtimes
**Active Downtimes** by severity (High red, Medium orange, Low blue). **Upcoming Downtimes** for the next 2 days. **View All** shows history with filters.

### 3.13 Settings (account-level)
- **Payment Methods** (Settings > Payment Gateway > Payment Methods): see active modes and **Request** new ones.
- **Preferences:** order expiry time (5 min to 30 days) and TTL (5 min to 24 h).
- **Bank Accounts:** the settlement account.
- **Checkout customisation:** Visual (logo 256x256, primary colour, advanced options for corner radius, text colours, header colour and text, brand display mode, buttons) and Business (method ordering and so on), with a live **Preview** panel and **Save**.
- **Access Management:** User Management, Role Management, Permissions.
- **Communication preferences:** settlement emails and alert recipients.

### 3.14 Team roles (Access Management)
Five default roles plus the Account Owner. Custom roles are possible, as are direct permissions (View and Manage toggles per module) and multiple roles per user (permissions are combined).

| Feature | Owner | Admin | Manager | Developer | Operations | Support |
|---|---|---|---|---|---|---|
| API Keys & Secrets | Full | Full | None | Full | None | None |
| Webhooks | Full | Full | None | Full | None | None |
| Orders & Payments | Full | Full | View | View | Full | View |
| Refunds | Full | Full | View | None | Full | View |
| Settlements | Full | Full | Full | None | View | None |
| Disputes | Full | Full | View | None | Full | View |
| Payouts | Full | Full | Full | None | Full | View |
| Payment Methods | Full | Full | Full | None | None | None |
| Reports | Full | Full | Full | View | Full | View |
| User Mgmt / Role Mgmt | Full | None | None | None | None | None |
| Account Settings | Full | Full | View | None | None | None |

Invite flow: **Settings > Access Management > User Management > Invite New User**. Enter the email, pick roles or "Enable permissions without a specific role", then **Invite New User**. The user appears in Invited Users until they accept. There is one Account Owner, and ownership transfer goes through support. Account deletion is not self-serve.

---

## 4. Checkout UX

### 4.1 Integration options

| Option | Who renders UI | PCI scope | How |
|---|---|---|---|
| **Hosted / redirect checkout** | Cashfree | None for merchant | JS SDK `cashfree.checkout({paymentSessionId, redirectTarget:"_self"})` redirects to the Cashfree page. On completion, a GET to `return_url` |
| **Popup checkout** | Cashfree (modal) | None | `redirectTarget: "_modal"`. Returns a promise |
| **Inline checkout** | Cashfree inside a merchant DOM element | None | `redirectTarget: document.getElementById("cf_checkout")` |
| **Elements (custom checkout)** | Merchant layout, Cashfree iframed fields | None (fields are Cashfree's) | `cashfree.create(component, options)` → `mount()` → `cashfree.pay()` |
| **Seamless / S2S (Order Pay API)** | Merchant fully | Plain cards need PCI DSS + S2S flags | `POST /pg/orders/sessions` |
| **Mobile SDKs** | Cashfree web checkout in-app, or native UPI intent | None | Android, iOS, Flutter, React Native, Cordova, Capacitor (unverified for Capacitor) |
| **No-code** | Cashfree | None | Payment Links, Forms, Buttons, plugins |

### 4.2 JS SDK v3

```html
<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
<!-- or: npm install @cashfreepayments/cashfree-js ; import { load } from "@cashfreepayments/cashfree-js" -->
<script>
  const cashfree = Cashfree({ mode: "sandbox" }); // or "production"
  // NPM: const cashfree = await load({ mode: "sandbox" });
  cashfree.checkout({
    paymentSessionId: "session_xxx",   // from Create Order
    redirectTarget: "_modal",          // _self (default) | _blank | _top | _modal | DOM element
    // returnUrl: "https://merchant/return?order_id={order_id}" (Elements docs show returnUrl as an option)
  }).then((result) => {
    if (result.error)  { /* popup closed or payment error → check status on server */ }
    if (result.redirect) { /* could not open in the same window; customer goes to return_url */ }
    if (result.paymentDetails) { console.log(result.paymentDetails.paymentMessage); }
  });
</script>
```

`redirectTarget` values:
- `_self`: same frame (default).
- `_blank`: new tab.
- `_top`: full window.
- `_modal`: popup.
- An `HTMLElement`: inline.

Redirect, popup and inline are the three checkout variants.

Tips:
- Add `order_tags.checkout_context` (for example `"Flight booking DEL-BOM, 12 JUN at 14:30"`) to show a context card on the checkout.
- UPI intent inside WebViews (JS SDK) is enabled per account, not per domain.

### 4.3 Elements (custom UI components)

Lifecycle: `create()` → `mount('#el')` → `pay()`. Components:

| Group | Components |
|---|---|
| Cards | `cardNumber`, `cardHolder`, `cardExpiry`, `cardCvv`, `savePaymentInstrument` |
| UPI | `upiCollect`, `upiApp`, `upiQr` |
| Others | `netbanking`, `wallet`, `paylater`, `cardlessEMI` |

Component state properties: `value`, `error`, `message`, `invalid`, `empty`, `complete`, `ready`, `componentName`, `node`, `mounted`. Components emit events (`ready`, `change`, `focus`, `blur`, `complete`; exact event set unverified). `cashfree.pay({paymentMethod: component, paymentSessionId, redirectTarget, savePaymentInstrument})` returns a promise with `error`, `redirect` or `paymentDetails`. Some parameter names are unverified.

### 4.4 Server-to-server (Order Pay)

Covered in §6.3. The flow is: Create Order, then `POST /pg/orders/sessions` with `payment_method` set, then act on the returned `action`:
- `link`: redirect to `data.url`.
- `post`: native OTP UI that posts to `data.url`, or use `POST /orders/pay/authenticate/{cf_payment_id}` with SUBMIT_OTP or RESEND_OTP.
- `form`: auto-submit `data.payload` to `data.url`.
- `custom`: UPI collect or QR data.

### 4.5 Mobile SDKs
- **Android:** `implementation 'com.cashfree.pg:api:2.6.1'` (Maven Central, minSdk 19). Session objects `CFWebCheckoutPayment` (web checkout) and `CFUPIIntentCheckoutPayment` (native UPI intent). Callbacks `onPaymentVerify(orderID)` and `onPaymentFailure(cfErrorResponse, orderID)` (callback names unverified). "Cashfree Integrity" (Play Integrity) checks run in production.
- **iOS, Flutter (`flutter_cashfree_pg_sdk`), React Native (`react-native-cashfree-pg-sdk`), Cordova:** same model. Pass `payment_session_id` and `order_id`, then verify on the server. Package names unverified.
- A UPI simulator APK exists for testing intent flows.

### 4.6 Payment methods and UI flows

| Category | Methods | UI flow | API key in `payment_method` | `payment_group` |
|---|---|---|---|---|
| Cards | Visa, Mastercard, RuPay, Maestro, Amex, Diners. Credit, debit, prepaid, corporate. International. Apple Pay, Google Pay cards | Enter card, then 3DS OTP (bank page or native OTP via `post` channel), then result. Save card (tokenised) on consent | `card` (`channel: link|post`) | `credit_card`, `debit_card`, `prepaid_card` |
| UPI | Intent (app list or `upi_app_priority`), QR, Collect (VPA). UPI on credit card (RuPay). UPI Lite / PPI | Intent: open app → PIN. QR: scan. Collect: enter VPA → approve in app (expiry `upi_expiry_minutes`) | `upi` (`channel: link|collect|qrcode|podQrCode`) | `upi`, `upi_credit_card`, `upi_ppi`, `upi_ppi_offline` |
| Netbanking | 50+ banks (bank codes, e.g. 3021, 3044) | Pick bank → bank login → redirect back | `netbanking` (`netbanking_bank_code`) | `net_banking` |
| Wallets | PhonePe, Paytm, Amazon Pay, MobiKwik, Freecharge, Airtel, JioMoney, Ola. Spec enum: gpay, phonepe, ola, paytm, amazon, airtel, freecharge, mobikwik, jio | Phone → wallet app or OTP | `app` (`provider`, `phone`) | `wallet` |
| Card EMI | Bank credit and debit EMI (hdfc, kotak, icici, rbl, bob, standard chartered, axis, au, yes, sbi, fed, hsbc, citi, amex), with tenures 3–36 | Choose bank → tenure → card | `emi` (`card_bank_name`, `emi_tenure`) | `credit_card_emi`, `debit_card_emi` |
| Cardless EMI | flexmoney, zestmoney, hdfc, icici, cashe, idfc, kotak, snapmint, bharatx | Phone → eligibility → OTP | `cardless_emi` | `cardless_emi` |
| Pay Later | simpl, lazypay, kotak, flexipay, olapostpaid, freechargepaylater | Phone → OTP | `paylater` | `pay_later` |
| Bank transfer | NEFT, RTGS, IMPS to a virtual account | Display account number and IFSC | `banktransfer` | `bank_transfer` |
| International | Cards in 140+ currencies, PayPal | n/a | `card` / `paypal` | `paypal` |
| Offline | softPOS, cash, COD (One Click Checkout) | n/a | n/a | `cash` |

Order-level restriction uses `order_meta.payment_methods`, a comma-separated list of: `cc, dc, ccc, ppc, nb, upi, paypal, app, paylater, cardlessemi, dcemi, ccemi, banktransfer, applepay`. A blank value shows all methods. For finer control use `payment_methods_filters` (card BINs, schemes, issuing bank, suffix, EMI tenure 3–36).

---

## 5. End-to-end integration flow

```
Merchant server                    Cashfree                            Customer
---------------                    --------                            --------
1 POST /pg/orders  ─────────────►  order ACTIVE + payment_session_id
2 return session id to frontend
3 cashfree.checkout({paymentSessionId}) ───────────────────────────►  pays (UPI/card/...)
4                                  payment SUCCESS/FAILED/USER_DROPPED
5                                  GET return_url?order_id=...  ─────►  browser redirected
6 webhook PAYMENT_*_WEBHOOK  ◄──── POST notify_url / configured endpoints (signed)
7 GET /pg/orders/{order_id} (order_status == PAID)  + GET /pg/orders/{id}/payments
8 fulfil order
9                                  T+1 / T+2 settlement → SETTLEMENT_* webhooks
10 POST /pg/orders/{id}/refunds (if needed) → REFUND_STATUS_WEBHOOK
```

### 5.1 Create Order

```bash
curl -X POST https://sandbox.cashfree.com/pg/orders \
  -H 'Content-Type: application/json' \
  -H 'x-api-version: 2026-01-01' \
  -H 'x-client-id: <APP_ID>' \
  -H 'x-client-secret: <SECRET>' \
  -H 'x-request-id: req_123' \
  -H 'x-idempotency-key: 6f1c1a3e-...' \
  -d '{
    "order_id": "order_1001",
    "order_amount": 10.10,
    "order_currency": "INR",
    "customer_details": {
      "customer_id": "USER123",
      "customer_name": "Joe",
      "customer_email": "joe@example.com",
      "customer_phone": "+919876543210"
    },
    "order_meta": {
      "return_url": "https://merchant.com/return?order_id=order_1001",
      "notify_url": "https://merchant.com/cf/webhook",
      "payment_methods": "cc,dc,upi"
    },
    "order_expiry_time": "2026-10-23T18:00:00+05:30",
    "order_note": "Two shirts",
    "order_tags": { "sku": "SHIRT-2" }
  }'
```

Response (200):

```json
{
  "cf_order_id": "2149460581",
  "order_id": "order_1001",
  "entity": "order",
  "order_currency": "INR",
  "order_amount": 10.10,
  "order_status": "ACTIVE",
  "payment_session_id": "session_a1b2c3...",
  "order_expiry_time": "2026-10-23T18:00:00+05:30",
  "order_note": "Two shirts",
  "created_at": "2026-10-23T12:00:00+05:30",
  "order_splits": [],
  "customer_details": { "customer_id": "USER123", "customer_name": "Joe", "customer_email": "joe@example.com", "customer_phone": "+919876543210", "customer_uid": "54deabb4-..." },
  "order_meta": { "return_url": "https://merchant.com/return?order_id=order_1001", "notify_url": "https://merchant.com/cf/webhook", "payment_methods": "cc,dc,upi" },
  "order_tags": { "sku": "SHIRT-2" },
  "cart_details": { "cart_id": "1" },
  "terminal_data": null,
  "products": { "one_click_checkout": { "enabled": false, "conditions": [] }, "verify_pay": { "enabled": false, "conditions": [] } }
}
```

Field constraints for the Create Order request:
- **Required:** `order_amount`, `order_currency`, `customer_details`.
- `order_id`: 3–45 characters, alphanumeric plus `_` and `-`. Auto-generated if omitted (format `order_<...>`).
- `order_amount`: minimum 1, up to 2 decimals.
- `customer_details.customer_id`: 3–50 alphanumeric characters.
- `customer_details.customer_phone`: 10 digits, or `+` plus country code.
- `customer_name` and `customer_email`: 3–100 characters.
- `order_note`: 3–200 characters.
- `order_tags`: up to 10 (docs) or 15 (schema) string pairs, each key and value 1–255 characters.
- `order_meta.return_url`: max 250 characters, receives a GET.
- `order_meta.notify_url`: must be https, max 250 characters.
- `order_expiry_time`: ISO-8601. Allowed window is 5 min to 30 days. Default is the dashboard setting (often 30 days).
- `customer_bank_account_number`, `customer_bank_ifsc`, `customer_bank_code`: for TPV.
- Also accepted: `cart_details` (items, shipping and billing addresses), `order_splits` (Easy Split), `terminal` (softPOS), `products` (one_click_checkout, verify_pay), `offer_filters` (ALLOW or DENY up to 25 offer IDs), `upi_app_priority`.

Response headers: `x-api-version`, `x-request-id`, `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-retry`, `x-ratelimit-type` (`ip` or `app_id`), `x-idempotency-key`, `x-idempotency-replayed` (`true` or `false`).

### 5.2 Checkout
Send `payment_session_id` to the client and call `cashfree.checkout(...)` (§4.2). Never send the secret to the client.

### 5.3 Return URL
After payment, Cashfree issues a GET to `return_url`. Without one, the customer lands on a default Cashfree page. Put your order context in the URL. **Do not trust the redirect.** Always verify on the server.

### 5.4 Verify

```bash
curl https://sandbox.cashfree.com/pg/orders/order_1001 -H 'x-api-version: 2026-01-01' -H 'x-client-id: ..' -H 'x-client-secret: ..'
# → order_status: PAID  ⇒ success
curl https://sandbox.cashfree.com/pg/orders/order_1001/payments -H ...
# → array of payment attempts (cf_payment_id, payment_status, payment_group, payment_method{...}, error_details)
```

Sample payment entity:

```json
{
  "cf_payment_id": "4128924251", "entity": "payment", "order_id": "order_1001",
  "order_amount": 1, "order_currency": "INR", "payment_amount": 1, "payment_currency": "INR",
  "payment_time": "2025-07-15T15:01:53+05:30", "payment_completion_time": "2025-07-15T15:02:48+05:30",
  "payment_status": "SUCCESS", "payment_message": "Transaction Success", "payment_group": "debit_card",
  "is_captured": true, "bank_reference": "519615460937", "auth_id": "749842", "authorization": null,
  "error_details": null,
  "payment_method": { "card": { "channel": "link", "card_number": "XXXXXXXXXXXX4738", "card_network": "visa",
    "card_type": "debit_card", "card_sub_type": "R", "card_country": "IN", "card_bank_name": "KOTAK MAHINDRA BANK",
    "card_network_reference_id": null } },
  "international_payment": { "international": false },
  "payment_gateway_details": { "gateway_name": "CASHFREE", "gateway_order_id": null, "gateway_payment_id": null,
    "gateway_order_reference_id": null, "gateway_status_code": null, "gateway_settlement": "cashfree", "gateway_reference_name": null },
  "payment_surcharge": { "payment_surcharge_service_charge": 0, "payment_surcharge_service_tax": 0 }
}
```

Note that Get Order / Get Payments only return the current and previous financial years. Older data is available only in the dashboard.

### 5.5 Webhooks, then settlement, then refunds
See §7 and §9. Recommended pattern: treat the webhook as the trigger, then call Get Order to confirm before fulfilling.

---

## 6. API reference (PG v2026-01-01)

All paths are relative to `https://{sandbox|api}.cashfree.com/pg`. Common headers: `x-api-version` (required), `x-client-id` and `x-client-secret` (or the partner and signature variants), `x-request-id` (optional), `x-idempotency-key` (optional UUID), `Content-Type: application/json`. Order Pay and Eligibility (payment_methods) also take the client-context headers `x-client-device`, `x-client-os`, `x-client-rendering-type` and `x-client-browser`.

### 6.1 Full endpoint list

| Method | Path | Summary |
|---|---|---|
| **Orders** | | |
| POST | `/orders` | Create Order |
| GET | `/orders/{order_id}` | Get Order |
| PATCH | `/orders/{order_id}` | Terminate Order (`{"order_status":"TERMINATED"}`) |
| GET | `/orders/{order_id}/extended` | Get Order Extended (address, cart, offers, customer) |
| PUT | `/orders/{order_id}/extended` | Update Order Extended (shipment status: AWAITING_PICKUP ... DELIVERED, RTO, LOST, etc.) |
| **Payments** | | |
| POST | `/orders/sessions` | Order Pay (S2S/seamless). No secret needed, only `payment_session_id` |
| POST | `/orders/sessions/authorize` | Order Pay Authorise Only (external 3DS: ALT_ID, TOKEN, APPLE_PAY) |
| POST | `/orders/pay/authenticate/{cf_payment_id}` | Submit or Resend OTP (native OTP) |
| POST | `/orders/{order_id}/authorization` | Preauthorisation CAPTURE or VOID |
| GET | `/orders/{order_id}/payments` | Get Payments for an Order |
| GET | `/orders/{order_id}/payments/{cf_payment_id}` | Get Payment by ID |
| **Refunds** | | |
| POST | `/orders/{order_id}/refunds` | Create Refund |
| GET | `/orders/{order_id}/refunds` | Get All Refunds for an Order |
| GET | `/orders/{order_id}/refunds/{refund_id}` | Get Refund |
| PUT | `/orders/{order_id}/refunds/{refund_id}` | Update Refund (cancel: `{"refund_status":"CANCELLED","remarks":".."}`) |
| **Settlements** | | |
| GET | `/orders/{order_id}/settlements` | Get Settlements by Order ID |
| POST | `/orders/settlements` | Mark Order For Settlement (on-hold or delayed settlement; `meta_data.settlement_date`) |
| POST | `/settlements` | Get All Settlements (cursor pagination, filters) |
| POST | `/settlement/recon` | Settlement Reconciliation |
| POST | `/recon` | PG Reconciliation (event-level ledger) |
| POST | `/recon/vendor` | Vendor Reconciliation |
| **Payment Links** | | |
| POST | `/links` | Create Payment Link |
| GET | `/links/{link_id}` | Fetch Payment Link |
| POST | `/links/{link_id}/cancel` | Cancel Payment Link |
| GET | `/links/{link_id}/orders` | Orders for a Link |
| **Customers / Token Vault** | | |
| POST | `/customers` | Create Customer (`customer_phone` required) → `customer_uid` |
| GET | `/customers/{customer_id}/instruments?instrument_type=card` | List saved cards |
| GET | `/customers/{customer_id}/instruments/{instrument_id}` | Get saved card |
| DELETE | `/customers/{customer_id}/instruments/{instrument_id}` | Delete saved card |
| GET | `/customers/{customer_id}/instruments/{instrument_id}/cryptogram` | Get network token cryptogram |
| **Offers / Eligibility** | | |
| POST | `/offers` | Create Offer |
| GET | `/offers/{offer_id}` | Get Offer |
| POST | `/eligibility/offers` | Eligible offers for order or amount |
| POST | `/eligibility/payment_methods` | Eligible payment methods |
| POST | `/eligibility/cardlessemi` | Eligible cardless EMI |
| POST | `/eligibility/paylater` | Eligible pay later |
| **Disputes** | | |
| GET | `/orders/{order_id}/disputes` | Disputes by order |
| GET | `/payments/{cf_payment_id}/disputes` | Disputes by payment |
| GET | `/disputes/{dispute_id}` | Get dispute |
| PUT | `/disputes/{dispute_id}/accept` | Accept |
| POST | `/disputes/{dispute_id}/documents` | Submit evidence (multipart) |
| PUT | `/disputes/{dispute_id}/contest-arbitration` | Contest an ARBITRATION (`note` up to 500 characters) |
| **Easy Split** | | |
| POST | `/easy-split/vendors` | Create vendor |
| GET/PATCH | `/easy-split/vendors/{vendor_id}` | Get or update vendor |
| POST/GET | `/easy-split/vendor-docs/{vendor_id}` | Upload docs or get docs status |
| GET | `/easy-split/vendor-docs/{vendor_id}/download/{doc_type}` | Download doc |
| GET | `/easy-split/vendors/{vendor_id}/balances` | On-demand balance |
| GET | `/easy-split/amount/{amount}/charges` | Transfer charges |
| POST | `/easy-split/vendors/{vendor_id}/transfer` | On-demand transfer (`transfer_from` MERCHANT or VENDOR, `transfer_type` ON_DEMAND or ADJUSTMENT) |
| POST | `/easy-split/orders/{order_id}/split` | Split after payment (`split[]`, `disable_split`) |
| POST | `/easy-split/static-split` | Static split configuration |
| POST | `/easy-split/vendors/{vendor_id}/adjustment` | Adjustment (CREDIT or DEBIT) |
| GET | `/easy-split/orders/{order_id}` | Split and settlement details |
| POST | `/split/order/vendor/recon` | Split recon v2 (cursor, limit 10–100) |
| **Subscriptions** | | |
| POST | `/plans` | Create plan |
| GET | `/plans/{plan_id}` | Fetch plan |
| POST | `/subscriptions` | Create subscription → `subscription_session_id` |
| GET | `/subscriptions/{subscription_id}` | Fetch subscription |
| POST | `/subscriptions/{subscription_id}/manage` | CANCEL, PAUSE, ACTIVATE, CHANGE_PLAN |
| POST | `/subscriptions/pay` | Raise charge (CHARGE) or auth (AUTH) |
| GET | `/subscriptions/{id}/payments` and `/subscriptions/{id}/payments/{payment_id}` | Payments |
| POST | `/subscriptions/{id}/payments/{payment_id}/manage` | CANCEL or RETRY a payment |
| POST/GET | `/subscriptions/{id}/refunds` and `/subscriptions/{id}/refunds/{refund_id}` | Refunds |
| POST | `/subscriptions/pay/controlled/notify-mandate` and `/execute-mandate` | Merchant-controlled pre-debit notification and execution |
| GET | `/subscriptions/payments/{payment_id}/controlled/notifications[/{id}]` and `.../executions[/{id}]` | Fetch controlled notifications and executions |
| POST | `/subscriptions/pay/documents/{payment_id}` | Upload physical NACH image (multipart, `action=SUBMIT_DOCUMENT`) |
| POST | `/subscriptions/eligibility/payment_methods` | Eligible methods (enach, pnach, upi, card) |
| POST | `/subscriptions/charge/{payment_id}/transaction-return-summary/generate` | Return summary |
| **softPOS** | | |
| POST | `/terminal`, `/terminal/transactions`, `/terminal/payments`, `/terminal/soundbox`, `/terminal/demap/soundbox`, `/terminal/{cf_terminal_id}/docs` | Terminal management, transactions, soundbox |
| GET | `/terminal/qrcodes`, `/terminal/soundbox/qrcodes`, `/terminal/{cf_terminal_id}/payments`, `/terminal/{terminal_phone_no}` | Terminal reads |
| PATCH | `/terminal/{cf_terminal_id}`, `/terminal/{cf_terminal_id}/status`, `/terminal/{cf_terminal_id}/soundbox` | Terminal updates |
| **Simulation (sandbox)** | | |
| POST/GET | `/simulate`, `/simulate/{simulation_id}` | Simulate payment status (entity PAYMENTS, SUBS_PAYMENTS or VBA_TRANSFER; status SUCCESS, FAILED, PENDING or USER_DROPPED) |
| POST/GET | `/simulate/settlement`, `/simulate/settlement/{id}` | Simulate settlement |
| POST | `/simulate/settlement/vendor` | Simulate vendor settlement (INITIATED, SUCCESS, FAILED) |
| POST/GET | `/simulate/easy-split/enable`, `/simulate/easy-split/status` | Enable Easy Split in sandbox (creates sample vendors) |
| **Utilities** | | |
| POST | `/utilities/cardbin` | BIN lookup (min 8 digits) → bank_name, scheme, type, sub_type, country_code |
| POST | `/utilities/pars` | Get PAR (payment account reference) |
| GET | `/incident`, `/incident/{id}` | Downtimes (filters: status, impact, type, time, payment_method) |

### 6.2 Entity status lifecycles

**Order (`order_status`)**

| Status | Meaning |
|---|---|
| `ACTIVE` | Created, no successful payment yet. New attempts allowed |
| `PAID` | A payment succeeded (terminal) |
| `EXPIRED` | Passed `order_expiry_time` with no success. **Can still flip to PAID** if an attempt started before expiry succeeds within TTL |
| `TERMINATED` | Merchant terminated it via PATCH. No further payments |
| `TERMINATION_REQUESTED` | Terminate acknowledged, waiting for in-flight attempts to reach a terminal state |

**Payment (`payment_status`)**

| Status | Terminal? | Meaning |
|---|---|---|
| `NOT_ATTEMPTED` | No | Attempt created, awaiting bank acknowledgement |
| `PENDING` | No | Sent to bank, awaiting response. Do not fulfil |
| `SUCCESS` | Yes | Captured. Order becomes PAID |
| `FAILED` | Yes | Bank, customer or system failure. Customer can retry (new `cf_payment_id`) |
| `USER_DROPPED` | Yes | Abandoned (OTP not entered, UPI PIN not entered, page closed) |
| `CANCELLED` | Yes | Success arrived after TTL and was auto-reversed |
| `VOID` | Yes | Pre-auth voided or not captured |
| `FLAGGED` | No | RiskShield hold. Merchant approves or rejects (listed in lifecycle doc, not in API enum) |

**Order expiry vs TTL:**
- Order expiry is counted from creation (5 min to 30 days). It is the deadline to *start* an attempt.
- TTL (Transaction Time Limit, also called TCT) is counted from method selection (5 min to 24 h). It is the deadline for the last attempt to reach a terminal state.
- Both are configured in **Settings > Preferences**.
- Example: an order created at 10:00 with 15 min expiry and 20 min TTL. An attempt at 10:02 is honoured until 10:22. The order goes EXPIRED at 10:15, then PAID if the attempt succeeds at 10:21.

**Refund (`refund_status`):** `PENDING` → `SUCCESS`. Other values: `PENDING_APPROVAL`, `ONHOLD` (insufficient balance), `CANCELLED` (by merchant via PUT, or by Cashfree after repeated failures), `REJECTED`.
- `refund_type`: `MERCHANT_INITIATED`, `PAYMENT_AUTO_REFUND`, `UNRECONCILED_AUTO_REFUND`.
- `refund_speed`: `STANDARD` or `INSTANT`. The response carries an object `{requested, accepted, processed, message}`.

**Settlement (`status`):** `PENDING`, `PENDING_WITH_CASHFREE`, `PENDING_WITH_BANK`, `SUCCESS`, `FAILED`. Webhook statuses are INITIATED, SUCCESS, FAILED and REVERSED. `settlement_type` values include `NORMAL_SETTLEMENT`/`STANDARD` and `INSTANT`. `charge_type`: PREPAID, POSTPAID, SURCHARGE, PREPAID_SURCHARGE, POSTPAID_SURCHARGE. `charged_to`: MERCHANT, CUSTOMER, MERCHANT_AND_CUSTOMER, VENDOR.

**Payment Link (`link_status`):** `ACTIVE` → `PAID` / `PARTIALLY_PAID` / `EXPIRED` / `CANCELLED`. Default expiry is 30 days. Link orders carry `order_tags.cf_link_id` and `order_tags.link_id`.

**Dispute:**
- `dispute_type`: `DISPUTE`, `RETRIEVAL`, `CHARGEBACK`, `PRE_ARBITRATION`, `ARBITRATION`.
- `dispute_status` is `<TYPE>_` followed by one of CREATED, DOCS_RECEIVED, UNDER_REVIEW, MERCHANT_WON, MERCHANT_LOST, MERCHANT_ACCEPTED or INSUFFICIENT_EVIDENCE. For example `DISPUTE_CREATED`, `CHARGEBACK_MERCHANT_WON`, `PRE_ARBITRATION_INSUFFICIENT_EVIDENCE`. Arbitration also has `ARBITRATION_CONTEST_REQUESTED`.
- `dispute_action_on`: MERCHANT or CASHFREE (webhook field).

**Subscription (`subscription_status`):** `INITIALIZED` → `BANK_APPROVAL_PENDING` → `ACTIVE`. From there it can move to `ON_HOLD` (failed charge), `PAUSED`/`CUSTOMER_PAUSED`, `CANCELLED`/`CUSTOMER_CANCELLED`, `COMPLETED` (max cycles reached), `EXPIRED`, `LINK_EXPIRED` or `CARD_EXPIRED`.
- Subscription payment `payment_type`: `AUTH` or `CHARGE`.
- Subscription payment statuses include `INITIALIZED`, `PENDING`, `SUCCESS`, `FAILED` and `CANCELLED`.
- Subscription refund statuses: `INITIALIZED`, `SUCCESS`, `CANCEL`, `PENDING`, `FAILED`.

**Vendor (Easy Split):** `ACTIVE`, `HOLD`, `NOT_ACTIVE`, `RISK_APPROVAL_PENDING`, `RISK_REJECTED`. Create and update requests accept `ACTIVE`, `BLOCKED` and `DELETED`.

**Token instrument:** `ACTIVE` or `INACTIVE`. Webhooks: INSTRUMENT_ACTIVE_WEBHOOK and INSTRUMENT_FAILED_WEBHOOK.

**Offer:** `offer_status` (values unverified; likely ACTIVE, INACTIVE, EXPIRED).

**Incident:**
- `incident_status`: ACTIVE, UPCOMING, RESOLVED.
- `incident_impact`: HIGH, MEDIUM, LOW.
- `incident_type`: SCHEDULED, UNSCHEDULED.
- Methods covered: UPI, CARD, NET_BANKING, WALLET.

### 6.3 Order Pay (S2S): `POST /orders/sessions`

Prerequisites: the S2S flag must be enabled. Raw card fields also need the PCI DSS flag.

Required headers: `x-api-version`, `x-client-device` (mobile, desktop or tablet), `x-client-os` (android, ios, windows, macos, linux, others), `x-client-browser` (safari, chrome, firefox, edge, others), and `x-client-rendering-type` (mweb, webview, native) when the device is mobile.

Body: `payment_session_id` (required), `payment_method` (required, a single key), `save_instrument`, `offer_id`, `transaction_expiry_time`.

| `payment_method` key | Fields |
|---|---|
| `card` | `channel` (link or post), `card_number`, `card_holder_name`, `card_expiry_mm`, `card_expiry_yy`, `card_cvv` **or** `instrument_id` (saved card), cryptogram/token fields for network tokens |
| `upi` | `channel` (link = intent, collect, qrcode, podQrCode). `upi_id` (collect). `upi_redirect_url`, `upi_expiry_minutes` |
| `netbanking` | `channel: link`, `netbanking_bank_code` (int) or `netbanking_bank_name` |
| `app` | `channel`, `provider` (gpay, phonepe, paytm, amazon, ...), `phone` |
| `emi` | `channel: link`, card fields, `card_bank_name`, `emi_tenure` |
| `cardless_emi` | `channel: link`, `provider`, `phone`. `emi_tenure` required for hdfc, icici, cashe, idfc and kotak |
| `paylater` | `channel: link`, `provider` (simpl, lazypay, kotak, ...), `phone` |
| `banktransfer` | `channel: link` |

Response: `cf_payment_id`, `payment_amount`, `payment_method`, `channel`, `action` (link, post, form or custom), and `data` {`url`, `payload`, `content_type`, `method`, plus method-specific fields such as `vpa`, `expiry`, `bank`, `account_number`, `ifsc`, `virtual_vpa`, and `redirect_to_bank` for the card post flow}.

```json
// UPI collect request
{ "payment_session_id": "session_xxx",
  "payment_method": { "upi": { "channel": "collect", "upi_id": "testsuccess@gocash", "upi_expiry_minutes": 10 } } }
// response
{ "action": "custom", "cf_payment_id": "7845123001", "payment_method": "upi", "channel": "collect",
  "payment_amount": 250, "data": { "vpa": "testsuccess@gocash", "expiry": "2025-10-07T18:30:00+05:30",
  "payload": null, "content_type": null, "method": null } }
// card (link) response
{ "action": "link", "cf_payment_id": "4105073870", "channel": "link", "payment_amount": 1.75,
  "payment_method": "card", "data": { "url": "https://api.cashfree.com/pg/view/gateway/session_xxx",
  "payload": null, "content_type": null, "method": null } }
```

Native OTP: `POST /orders/pay/authenticate/{cf_payment_id}` with body `{"action":"SUBMIT_OTP","otp":"111000"}` or `{"action":"RESEND_OTP"}`. The response is `{cf_payment_id, action, authenticate_status: SUCCESS|FAILED, payment_message}`. A SUCCESS here does not mean the payment succeeded, so still poll the payment status.

### 6.4 Preauthorisation
- Enable pre-auth on the account. Then call `POST /orders/{order_id}/authorization` with `{"action":"CAPTURE","amount":100}` or `{"action":"VOID"}`.
- The payment entity's `authorization` object holds `action`, `status` (SUCCESS or PENDING), `captured_amount`, `start_time`/`end_time`/`approve_by` (UPI only), `action_reference` and `action_time`.
- In sandbox, create the order with `order_note: "preauth_transaction"`. Card and UPI are supported via the Order Pay `link` channel.

### 6.5 Payment Links: `POST /links`
- **Request:** `link_id` (≤50 characters, alphanumeric plus `-` and `_`), `link_amount`*, `link_currency`*, `link_purpose`, `customer_details`* (`customer_phone`* plus optional email, name, and bank fields for TPV), `link_partial_payments`, `link_minimum_partial_amount`, `link_expiry_time`, `link_notify` {`send_sms`, `send_email`}, `link_auto_reminders`, `link_notes` (≤5 pairs), `link_meta` {`notify_url`, `upi_intent`, `return_url`, `payment_methods`}, `order_splits`, `enable_invoice`, `subscription` {plan_details, authorization_amount, ...}.
- **Response:** `cf_link_id`, `link_id`, `link_status`, `link_amount_paid`, `link_url` (for example `https://payments.cashfree.com/links/...`), `link_qrcode` (base64), `link_created_at`, `link_expiry_time`, and the other request fields echoed back.

### 6.6 Offers: `POST /offers`
- `offer_meta` {`offer_title`, `offer_description`, `offer_code`, `offer_start_time`, `offer_end_time`}
- `offer_tnc` {`offer_tnc_type`: text or link, `offer_tnc_value`}
- `offer_details` {`offer_type`: DISCOUNT, CASHBACK, DISCOUNT_AND_CASHBACK or NO_COST_EMI; `discount_details` {discount_type flat or percentage, discount_value, max_discount_amount}; `cashback_details` {cashback_type, cashback_value, max_cashback_amount}}
- `offer_validations` {`min_amount`, `max_allowed`, `payment_method` {all, card, netbanking, app, upi, paylater, emi}}
- Response adds `offer_id`, `offer_status`, `order_amount`, `payable_amount`, `redemption_amount`, `platform`.
- Apply an offer on Order Pay via `offer_id`, or restrict offers on an order via `order_meta.offer_filters`.

### 6.7 Eligibility
- `POST /eligibility/payment_methods`: body `{"queries":{"order_id":"..","amount":100},"filters":{"payment_methods":["upi","card"]}}`. Response is an array of `{eligibility, entity_type, entity_value, entity_details{payment_method_details[]}}`.
- `POST /eligibility/offers`: body `{"queries":{"order_id"|"amount"},"filters":{"offer_type":[...]}}`.
- `POST /eligibility/cardlessemi` and `/eligibility/paylater`: body `{"queries":{"order_id","amount","customer_details":{"customer_phone"}}}` (shape partly unverified).

### 6.8 Customers and Token Vault
- `POST /customers` with `{customer_phone*, customer_email, customer_name}` returns `customer_uid`. Pass it in the order's `customer_details.customer_uid`.
- Saved instrument: `customer_id`, `afa_reference` (cf_payment_id of the saving txn), `instrument_id`, `instrument_type: card`, `instrument_uid`, `instrument_display`, `instrument_status`, `created_at`, `instrument_meta` {card_network, card_bank_name, card_country, card_type, card_sub_type, card_token_details}.
- Cryptogram: `token_requestor_id`, `card_number` (token), `card_expiry_mm`/`yy`, `cryptogram`, `card_display`.

### 6.9 Subscriptions (key fields)
- **Create Plan:** `plan_id`*, `plan_name`*, `plan_type`* (PERIODIC or ON_DEMAND), `plan_currency`, `plan_recurring_amount` (PERIODIC), `plan_max_amount`*, `plan_max_cycles`, `plan_intervals`, `plan_interval_type` (DAY, WEEK, MONTH, YEAR), `plan_note`.
- **Create Subscription:**
  - `subscription_id`*
  - `customer_details`* {customer_email*, customer_phone*, bank fields for TPV, `customer_bank_account_type` SAVINGS or CURRENT}
  - `plan_details`* (existing `plan_id` or an inline plan)
  - `authorization_details` {authorization_amount (always 0 for eNACH), authorization_amount_refund, payment_methods [enach, pnach, upi, card]}
  - `subscription_meta` {return_url, notification_channel [SMS, EMAIL], session_id_expiry}
  - `subscription_expiry_time`, `subscription_first_charge_time`, `subscription_tags` (≤10), `subscription_payment_splits`
  - The response includes `subscription_session_id` (used with the JS SDK `subscriptionsCheckout` (method name unverified) or hosted checkout), `cf_subscription_id`, `subscription_status` and `next_schedule_date`.
- **Raise charge:** `POST /subscriptions/pay` with `{subscription_id, payment_id, payment_type:"CHARGE", payment_amount, payment_schedule_date (UPI/card), payment_remarks}`. AUTH uses `subscription_session_id` plus `payment_method` {upi, enach, pnach, card}.
- **Limits:** e-mandate up to ₹1 crore; UPI Autopay ₹15,000 to ₹1,00,000 depending on authentication; card SI flexible. UPI refunds are STANDARD only, while eNACH/pNACH refunds are INSTANT only (per the refund API description).

### 6.10 Easy Split
- **Vendor create:** `vendor_id`*, `status`*, `name`*, `email`*, `phone`*, `verify_account`, `dashboard_access`, `schedule_option` (settlement cycle id), `bank` {account_number, account_holder, ifsc} or `upi` {vpa, account_holder}, `kyc_details`* {account_type, business_type, uidai, gst, cin, pan, passport_number, driving_license, voter_id}.
- **Order-level split:** `order_splits: [{vendor_id, amount | percentage, tags}]` on Create Order or Create Link.
- **Refund split:** `refund_splits: [{vendor_id, amount, tags}]`.
- Settlement options: standard, instant, on-demand, and delayed (order-level or vendor-level).

---

## 7. Webhooks

### 7.1 Setup
- **Dashboard path:** **Payment Gateway > Developers > Webhooks > Add Webhook Endpoint**. Enter the URL, pick the **version** (for example `2023-08-01`, `2025-01-01`, `2026-01-01`), click **Test**, choose events, then **Add Webhook**.
- Production requires https. Sandbox accepts http too.
- `order_meta.notify_url` on Create Order acts as an implicit per-order endpoint, shown as a non-editable "NOTIFY_URL" config.
- Configuration is per MID. Payment Link events can't be set at partner level.
- Delivery: HTTP POST with a JSON body (`content-type: application/json`). Legacy Payment Link webhooks are form-data; Cashgram webhooks are `x-www-form-urlencoded`.

Dashboard event checkboxes:
- Payments: Success Payment, Failed Payment, User Dropped Payment, Success Payment TDR (`PAYMENT_CHARGES_WEBHOOK`)
- Refund
- Settlements: Settlement Initiated, Settlement Failed, Settlement Reversed (plus success)
- Vendor settlements: Vendor Settlement Initiated, Success, Failed, Reversed
- Disputes: Dispute Created, Updated, Closed
- Tokens: Instrument Active, Instrument Failed
- Incident

### 7.2 Headers (2026-01-01)

| Header | Example | Notes |
|---|---|---|
| `x-webhook-signature` | `BUl8l3gElw9rlWUg0u3diRQMDzp1RysuTvxca2J5qOk=` | Base64 HMAC-SHA256 |
| `x-webhook-timestamp` | `1785401067911` | Epoch milliseconds, used in the signature |
| `x-webhook-version` | `2026-01-01` | Payload schema version |
| `x-webhook-attempt` | `1` | Delivery attempt number |
| `x-idempotency-key` | `A5UkesCnpkM4gGG+RpMLQ9coTGyN56UWXPoQjfYeuII=` | Hash unique per payload, for dedupe. Docs also call it `x-idempotency-header`. Available from version 2025-01-01 |
| `content-type`, `content-length` | `application/json` | n/a |

### 7.3 Signature verification

```
signedPayload     = x-webhook-timestamp + rawBody        // plain concatenation, no separator
expectedSignature = Base64( HMAC_SHA256(key = clientSecret, msg = signedPayload) )
valid iff expectedSignature == x-webhook-signature
```

- Use the **raw** body. Parsing JSON changes numbers (for example `170.00` becomes `170`) and breaks the signature.
- One doc page shows `timestamp.payload` with a dot, but every code sample (Node, Go, Java, PHP, Python) concatenates with no separator. Follow the code samples.
- SDK helper: `cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp)` in Node, Go, PHP, Python, Java and C#.
- Payment Links, Payouts v2, Secure ID and PPI use the same algorithm. Cashgram (form POST) is different: sort the POST params by key (excluding `signature`), concatenate the non-empty values, then Base64 HMAC-SHA256 with the secret.

```js
const crypto = require("crypto");
function verify(req) {
  const data = req.headers["x-webhook-timestamp"] + req.rawBody;
  const sig = crypto.createHmac("sha256", process.env.CF_SECRET).update(data).digest("base64");
  if (sig !== req.headers["x-webhook-signature"]) throw new Error("bad signature");
  return JSON.parse(req.rawBody);
}
```

### 7.4 Retries and resends
- Any non-200 response, including 4xx and 5xx, causes a retry. Return 200 immediately.
- Retry policies (dashboard, per URL):

| Policy | Behaviour |
|---|---|
| **Default** | 3 retries at 2, 10 and 30 min |
| **Fixed** | Up to 10 retries at a fixed interval |
| **Exponential** | Up to 10 retries with an interval and multiplier (doc example 15, 17, 19, 23, 31 min) |
| **Custom** | Up to 10 retries at custom intervals |

- **Batch Resend** (payment webhooks only): Developers > Webhooks > Logs, by comma-separated txn IDs, by uploaded file, or by a time window of up to 24h.
- Delivery is **at-least-once**. Dedupe by `x-idempotency-key` and by `cf_payment_id`.
- **Version migration:** add a new endpoint with the new version, make it return 200, then enable it. You receive both versions in parallel. Switch your code over, then disable and delete the old endpoint.

### 7.5 Event catalogue (`type` field)

| Product | Event `type` | Trigger |
|---|---|---|
| Payments | `PAYMENT_SUCCESS_WEBHOOK` | Payment SUCCESS |
| | `PAYMENT_FAILED_WEBHOOK` | Bank returned failure (includes `error_details`) |
| | `PAYMENT_USER_DROPPED_WEBHOOK` | Customer abandoned |
| | `PAYMENT_CHARGES_WEBHOOK` | TDR or charges finalised after success ("Success Payment TDR") |
| Refunds | `REFUND_STATUS_WEBHOOK` | Merchant refund SUCCESS or CANCELLED |
| | `AUTO_REFUND_STATUS_WEBHOOK` | Auto-refund (duplicate or late payment, payment after terminal order, direct-to-VPA) |
| Settlements | `SETTLEMENT_INITIATED`, `SETTLEMENT_SUCCESS`, `SETTLEMENT_FAILED`, `SETTLEMENT_REVERSED` | Merchant payout (also covers instant and on-demand). Events-by-product page names this `SETTLEMENT_STATUS_WEBHOOK` (unverified alias) |
| | `TRANSACTION_WISE_SETTLEMENT_SUCCESS` (and siblings) | Transaction-wise settlement model |
| Easy Split | `VENDOR_SETTLEMENT_INITIATED`, `VENDOR_SETTLEMENT_SUCCESS`, `VENDOR_SETTLEMENT_FAILED`, `VENDOR_SETTLEMENT_REVERSED` | Vendor payouts |
| | `VENDOR_STATUS_UPDATE` | Vendor status change |
| Disputes | `DISPUTE_CREATED`, `DISPUTE_UPDATED`, `DISPUTE_CLOSED` | Dispute lifecycle |
| Payment Links | `PAYMENT_LINK_EVENT` (with a `version: 1` field) | Paid, partially paid, cancelled, expired |
| Payment Forms | `PAYMENT_FORM_ORDER_WEBHOOK` | Form payment |
| Token Vault | `INSTRUMENT_ACTIVE_WEBHOOK`, `INSTRUMENT_FAILED_WEBHOOK` | Tokenisation result |
| Subscriptions | `SUBSCRIPTION_STATUS_CHANGED`, `SUBSCRIPTION_AUTH_STATUS`, `SUBSCRIPTION_PAYMENT_NOTIFICATION_INITIATED`, `SUBSCRIPTION_PAYMENT_SUCCESS`, `SUBSCRIPTION_PAYMENT_FAILED`, `SUBSCRIPTION_PAYMENT_CANCELLED`, `SUBSCRIPTION_REFUND_STATUS`, `SUBSCRIPTION_CARD_EXPIRY_REMINDER`, `SUBSCRIPTION_CONTROLLED_NOTIFICATION_STATUS`, `SUBSCRIPTION_CONTROLLED_EXECUTION_STATUS` | Mandate and charge lifecycle |
| VBA | `VBA_TRANSFER_SUCCESS_PAYMENT` (2022 version; newer accounts get PG payment webhooks) | Credit to a virtual account |
| softPOS | Terminal transaction webhooks (names not captured) | n/a |
| Incident | Incident webhook (name not captured) | Downtime start or end |
| One Click Checkout | Abandoned checkout webhook | Cart abandonment |
| Global Collections | Partner webhooks | Inward remittance |

### 7.6 Sample payloads

**PAYMENT_SUCCESS_WEBHOOK (2026-01-01):**

```json
{
  "data": {
    "order": { "order_id": "order_1112353J...", "order_amount": 1, "order_currency": "INR",
               "order_tags": { "Merchant_ID": "123456" }, "order_note": "..." },
    "payment": {
      "cf_payment_id": "1453995084705707520", "payment_status": "SUCCESS", "payment_amount": 1,
      "payment_currency": "INR", "payment_message": "Simulated response message",
      "payment_time": "2026-09-17T11:47:22+05:30", "bank_reference": "1453995084705707520", "auth_id": null,
      "payment_method": { "netbanking": { "channel": null, "netbanking_bank_code": "3032",
                                          "netbanking_bank_name": "Kotak Mahindra Bank" } },
      "payment_group": "net_banking", "international_payment": null,
      "payment_surcharge": { "payment_surcharge_service_charge": 0, "payment_surcharge_service_tax": 0 }
    },
    "customer_details": { "customer_name": "ABC co", "customer_id": "Customer_123",
                          "customer_email": null, "customer_phone": "8971520300" },
    "payment_gateway_details": { "gateway_name": "CASHFREE", "gateway_order_id": "1453994974886245888",
      "gateway_payment_id": "1453995084705707520", "gateway_status_code": null,
      "gateway_order_reference_id": null, "gateway_settlement": "CASHFREE", "gateway_reference_name": null },
    "payment_offers": null,
    "terminal_details": null
  },
  "event_time": "2026-09-17T11:47:29+05:30",
  "type": "PAYMENT_SUCCESS_WEBHOOK"
}
```

- **PAYMENT_FAILED_WEBHOOK** has the same structure plus `payment.error_details` {error_code (for example `TRANSACTION_DECLINED`), error_description, error_reason (for example `bank_rejected`), error_source (bank, customer, cashfree), error_code_raw, error_description_raw, error_subcode_raw (for example `U09`)}.
- **PAYMENT_USER_DROPPED_WEBHOOK** carries order, payment, customer_details and terminal_details, with no gateway details or offers in 2026-01-01.
- **PAYMENT_CHARGES_WEBHOOK** adds `charges_details` {service_charge, service_tax, settlement_amount, settlement_currency, service_charge_discount}, and `payment_method` may be `{}`.

**REFUND_STATUS_WEBHOOK (2025-01-01):**

```json
{ "data": { "refund": { "cf_refund_id": 11325632, "cf_payment_id": 789727431, "refund_id": "refund_sampleorder0413",
  "order_id": "sampleorder0413", "refund_amount": 2.00, "refund_currency": "INR", "entity": "Refund",
  "refund_type": "MERCHANT_INITIATED", "refund_arn": "205907014017", "refund_status": "SUCCESS",
  "status_description": "Refund processed successfully", "created_at": "2022-02-28T12:54:25+05:30",
  "processed_at": "2022-02-28T13:04:27+05:30", "refund_note": "Test",
  "refund_splits": [{ "merchantVendorId": "sampleID12345", "amount": 1, "percentage": null }],
  "metadata": null, "requested_speed": "STANDARD", "processed_speed": "STANDARD",
  "service_charge": 0.00, "service_tax": 0.00, "forex_conversion_handling_charge": null,
  "forex_conversion_handling_tax": null, "forex_conversion_rate": null, "charges_currency": null } },
  "event_time": "2022-02-28T13:04:28+05:30", "type": "REFUND_STATUS_WEBHOOK" }
```

`AUTO_REFUND_STATUS_WEBHOOK` uses `data.auto_refund` {event: "AUTO-REFUND", cf_refund_id, cf_payment_id, bank_reference, order_id, refund_amount, refund_type: PAYMENT_AUTO_REFUND, refund_arn, refund_status, status_description, refund_reason (for example "Multiple payments were performed against same order."), created_at, processed_at, refund_charge, ...}.

**SETTLEMENT_SUCCESS (2025-01-01):**

```json
{ "data": { "settlement": { "adjustment": 0, "amount_settled": 97.94, "payment_amount": 100,
  "payment_from": "2025-02-14 12:00:00", "payment_till": "2025-02-14 12:15:00", "reason": null,
  "service_charge": 1.75, "service_tax": 0.31, "settled_on": "2025-02-14T12:35:19+05:30",
  "settlement_type": "STANDARD", "settlement_amount": 97.94, "settlement_id": 738,
  "settlement_initiated_on": "2025-02-14T12:35:17+05:30", "status": "SUCCESS", "utr": 1644822317781212,
  "settlement_charge": 0, "settlement_tax": 0, "remarks": null } },
  "event_time": "2022-02-08T13:37:34+05:30", "type": "SETTLEMENT_SUCCESS" }
```

Here `adjustment` is the sum of refunds, disputes and chargebacks netted in this settlement. `settlement_charge` and `settlement_tax` apply to instant settlement.

**DISPUTE_CREATED (2025-01-01):**

```json
{ "data": { "dispute": { "dispute_id": "433475258", "dispute_type": "DISPUTE", "reason_code": "1402",
  "reason_description": "Duplicate Processing", "dispute_amount": 3, "created_at": "2023-06-15T21:49:48+05:30",
  "updated_at": "2023-06-15T21:49:48+05:30", "respond_by": "2023-06-18T23:59:59+05:30",
  "dispute_status": "DISPUTE_CREATED", "cf_dispute_remarks": "Dispute is created, please take action",
  "dispute_action_on": "MERCHANT", "dispute_amount_currency": "INR" },
  "order_details": { "order_id": "order_1944392...", "order_amount": 3, "order_currency": "INR",
                     "cf_payment_id": 885473311, "payment_amount": 3, "payment_currency": "INR" },
  "customer_details": { "customer_name": "...", "customer_phone": "8000000000", "customer_email": "..." } },
  "event_time": "2023-06-15T21:50:04+05:30", "type": "DISPUTE_CREATED" }
```

**PAYMENT_LINK_EVENT:** `data` has the link fields (`cf_link_id`, `link_id`, `link_status`, `link_amount`, `link_amount_paid`, ...) plus `order` {order_amount, order_id, order_expiry_time, order_hash, transaction_id, transaction_status}. `order` is null for cancelled or expired links. Also present: `"type":"PAYMENT_LINK_EVENT"`, `"version":1` and `event_time`.

**INSTRUMENT_ACTIVE_WEBHOOK:** `data.instrument` {customer_id, afa_reference, instrument_id, instrument_type, instrument_uid, instrument_display, instrument_status, added_at, instrument_meta {card_network, card_bank_name, card_country, card_type, sub_type, card_token_type: "PG_CASHFREE", card_par, card_token_details}}.

### 7.7 Idempotency best practices (official)
- An order can have many attempts, and each has a unique `cf_payment_id`.
- Only `SUCCESS` is final. Expected sequences include `FAILED → PENDING → SUCCESS`.
- Store every `cf_payment_id` per order. Mark the order PAID only when the order ID matches, the status is SUCCESS, and it is not already PAID.
- Ignore duplicate FAILED webhooks.

---

## 8. Errors, rate limits, idempotency, pagination

### 8.1 Error format (API)

```json
{
  "message": "bad URL, please check API documentation",
  "help": "Check latest errors and resolution from Merchant Dashboard API logs: ...",
  "code": "request_failed",
  "type": "invalid_request_error"
}
```

| HTTP | `type` | Example `code` |
|---|---|---|
| 400 | `invalid_request_error` / `validation_error` | `request_failed`, `order_amount_invalid`, `customer_phone_invalid`, `payment_session_id_invalid` |
| 401 | `authentication_error` | `request_failed` ("authentication Failed") |
| 403 | `feature_not_enabled` | (for example S2S or pre-auth not enabled) |
| 404 | `invalid_request_error` | `order_not_found`, `refund_get_not_found`, `link_get_not_found` |
| 409 | `invalid_request_error` | `order_already_exists`, `order_already_paid` |
| 422 | `idempotency_error` | Same key, different body |
| 429 | `rate_limit_error` | Check `x-ratelimit-retry` |
| 500 | `api_error` | `internal_error` |
| 502 | `bad_gateway_error` | `bank_processing_failure` |
| n/a | `api_connection_error` | Network |

More codes from the error catalogue:
- `card_unsupported`, `payment_method_unsupported`, `surcharge_invalid`, `order_inactive`, `order_expiry_time_invalid`, `order_id_voided`
- `refund_amount_invalid`, `refund_id_invalid`, `refund_unsupported`, `netbanking_bank_code_invalid`, `vendor_id_invalid`, `payment_gateway_inactive`
- `sdk_token_invalid`, `emi_tenure_invalid`, `card_number_invalid`, `authorize_only_invalid`, `cryptogram_request_failed`, `instrument_not_found`, `offer_not_found`
- `domain_name_refererString` (domain not whitelisted), `android_package_{x}`, `cod_eligibility_failed`
- The full payment-failure list is published as an XLSX ("Payment Error List").

Payment-level failures go in `error_details` {error_code, error_description, error_reason, error_source} on the payment entity and in the FAILED webhook. Example: `TRANSACTION_DECLINED` / `bank_rejected` / `bank`.

### 8.2 Rate limits (per minute; type is Account (app_id) or IP)

| API | Production | Sandbox | Type |
|---|---|---|---|
| Create Order | 200 | 30 | Account |
| Get Order | 400 | 60 | Account |
| Get Payments | 100 | 30 | Account |
| Get Payment by ID | 130 | n/a | Account |
| Pay Order (`/orders/sessions`) | 100 | 30 | IP |
| Get Settlements | 30 | 20 | Account |
| Initiate Refund | 100 | 30 | Account |
| Get Refund | 30 | 60 | Account |

Response headers: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-retry` (seconds to wait), `x-ratelimit-type` (`app_id` or `ip`). A breach returns 429 with `rate_limit_error`. Increases go through **Developers > Rate Limits > Request new limit** (rate and burst, where total = rate + burst), approved in 1-2 business days. Subscriptions have their own rate-limit page.

### 8.3 Idempotency
- The request header `x-idempotency-key` (UUID) is supported on POST calls such as Create Order and Create Refund.
- A retry with the same key and body returns the original response with `x-idempotency-replayed: true`.
- The same key with a different body returns 422 `idempotency_error`.
- Natural idempotency also applies: a duplicate `order_id` returns 409 `order_already_exists`, and `refund_id` must be unique per order.
- The idempotency key retention window is not documented (unverified).
- `x-request-id` is a merchant-supplied trace ID to include in support tickets.

### 8.4 Pagination
- Most "list" endpoints for an order (payments, refunds, settlements by order, disputes by order) return **unpaginated arrays**.
- Bulk reporting endpoints use **cursor pagination** in the POST body: `{"pagination":{"limit":10..1000,"cursor":null},"filters":{...}}`. The response is `{cursor, limit, data[]}`. Applies to `/settlements`, `/settlement/recon`, `/recon` (max limit 1000, default 10) and `/split/order/vendor/recon` (limit 10–100).
- Settlement filters: `cf_settlement_ids[]`, `settlement_utrs[]`, `settlement_status[]`, `start_date`, `end_date`.

### 8.5 Versioning
- `x-api-version` is a date (`YYYY-MM-DD`). Each request is pinned explicitly; there is no account default.
- Webhook versions are pinned per endpoint, independent of the REST version.
- Docs keep "previous" trees for 2025-01-01, 2023-08-01 and 2022-09-01.

---

## 9. Refunds, settlements, disputes

### 9.1 Refunds
- **Types:** full, partial, and multiple partials (total ≤ captured). Some methods don't support partial refunds.
- **Window:** up to **6 months** from the successful transaction.
- **Speed:** `STANDARD` (default; 5–7 or 7–10 business days to the customer depending on method) or `INSTANT` (UPI; minutes; fee applies). The dashboard has an info icon showing the charges.
- **API:** `POST /orders/{order_id}/refunds` with `{refund_amount, refund_id (3–40 characters), refund_note (3–100 characters), refund_speed, refund_splits}`.
  - Sandbox trick: set `refund_note` to `SUCCESS`, `FAILED`, `PENDING` or `ACTIVE` to simulate an outcome.
- **Cancel:** `PUT /orders/{order_id}/refunds/{refund_id}` with `{"refund_status":"CANCELLED"}`. Only possible for pending or on-hold refunds (likely).
- **Asynchronous outcome:** the request is accepted instantly, and the result arrives via `REFUND_STATUS_WEBHOOK`.
- **ONHOLD:** insufficient unsettled balance. The **Refund Wallet** (a prefunded pool separate from settlements) avoids holds and keeps settlements gross.
- **Auto refunds:** triggered for payments after the order is terminal or expired, duplicate payments on the same order, TTL breaches (late success moves to CANCELLED), and direct payments to the merchant VPA without an order. Delivered via `AUTO_REFUND_STATUS_WEBHOOK` and shown in the **Auto Refunds** dashboard tab.
- **Batch refunds:** dashboard CSV upload.
- `refund_arn`: the bank Acquirer Reference Number customers can use to trace a refund.
- **Refund communication:** Cashfree notifies customers, and the Customer Hub lets end customers track refunds.

### 9.2 Settlements
- **Default cycle:** **T+2 bank working days**. T+1 is possible via support. Business days exclude weekends and RBI Mumbai bank holidays.
- **Computation:** gross payments − PG service charge − GST (18%) − refunds, chargebacks and adjustments, giving `amount_settled`. Prepaid vs postpaid charge models are in `charge_type`.
- **Instant settlements:** within about 15 minutes. 0.30% fee + GST (pricing page). Eligibility criteria apply.
- **On-demand settlements:** 24x7 including holidays. Activate via Settlements > On-Demand > Request Activation, then use **Settle Now**, enter the amount, and confirm (shows charges).
- **Settlement reversal:** the bank returned the payout (invalid IFSC or account, NRE account, inactive account, transfer limit exceeded, wrong beneficiary name, and so on). It is retried next cycle if the merchant is active. A `SETTLEMENT_REVERSED` webhook is sent.
- **Mark Order For Settlement:** `POST /orders/settlements` controls holding or releasing specific orders on a requested date (on-hold settlement feature).
- **Recon APIs:**
  - `/settlements`: list settlements with UTR and charges.
  - `/settlement/recon`: settlement-level recon.
  - `/recon`: event-level ledger with `event_type` PAYMENT, REFUND, REFUND_REVERSAL, DISPUTE, DISPUTE_REVERSAL, CHARGEBACK, CHARGEBACK_REVERSAL, ... and `sale_type` CREDIT or DEBIT.
  - `/orders/{id}/settlements`: settlement for one order.
- Simulate in sandbox via `/simulate/settlement`.

### 9.3 Disputes and chargebacks

Types, deadlines and timelines:

| Type | Response window | Resolution |
|---|---|---|
| Dispute | 3 calendar days (1 day for real-time fraud) | 5–7 business days for complaints. Fraud cases can take months |
| Retrieval (soft chargeback) | 3 calendar days | If contested, 30–45 day wait for a possible chargeback. If accepted, about 10 days |
| Chargeback | 3 calendar days | 30–45 days when contested (UPI is shorter) |
| Pre-arbitration | 2 calendar days | n/a |
| Arbitration (final; card network or NPCI decides; heavy fee for the loser) | 1 calendar day | Long |

- **States (dashboard):** Action Required → (accept) Closed (Merchant Accepted). Or contest/upload → Under Review → Closed (Merchant Won) or Closed (Merchant Lost).
  - Insufficient evidence sends the dispute back to Action Required.
  - For arbitration: Action Required → Contest Requested (via API) → Under Review.
  - No response by `respond_by` means you lose automatically and the customer is refunded.
  - A customer can escalate to pre-arbitration or arbitration even after Merchant Won.
- **APIs:** get by order, payment or dispute ID; `PUT /disputes/{id}/accept`; `POST /disputes/{id}/documents` (evidence; `preferred_evidence[]` lists suggested `document_type`s); `PUT /disputes/{id}/contest-arbitration` (no new evidence; pre-arb evidence carries forward).
- **Parties:** customer, merchant, issuing bank, acquiring bank, card scheme or NPCI, and Cashfree.
- **Reason codes:** network codes, for example `1402` = Duplicate Processing. A reason-code list page exists.

---

## 10. Pricing, SDKs, plugins, security and compliance

### 10.1 Pricing (cashfree.com/payment-gateway-charges, read 2026-10-23)
- **Setup fee:** ₹0. An annual maintenance charge applies only for premium services (dedicated account manager, priority support, dispute management). The amount is not published.
- **Standard PG rate:** **1.95%** per successful transaction (UPI, RuPay, Maestro, cards, netbanking, wallets and so on).
  - Amex and Diners: 2.0%.
  - Credit card EMI: 2.2%. Debit card EMI: 1.5%. Cardless EMI: +1.90%.
  - Pay Later: 2.20–2.50%.
  - Virtual account IMPS/NEFT/RTGS: ₹20 per txn.
  - International Visa/Mastercard: 2.99%. International Amex: 2.95%. PayPal: PayPal's own fees.
  - The page's mapping of some rates to methods is ambiguous.
- **UPI and RuPay debit (MDR regulation):** India mandates zero MDR on UPI P2M and RuPay debit for most cases. Cashfree's page still lists them under the 1.95% "platform fee". Confirm current treatment, especially for large merchants (unverified).
- **Promotion:** Festive Offer of 0% platform fee on the first ₹20 lakh GMV for new merchants, with T+1 settlement by 8 PM. Excludes Amex, Diners, corporate, EMI, prepaid, pay later, e-mandate and international.
- **Subscriptions:** cards and e-mandate ₹7.5 + ₹7.5 (mandate creation + per presentation). UPI Autopay ₹7.5 + ₹5 (<₹1,000) or ₹7.5 + ₹15 (≥₹1,000). Plus platform fees.
- **Easy Split:** 0.20% / 0.25%.
- **Instant settlement:** 0.30% + GST.
- **Payouts:**

| Amount | NEFT | RTGS | IMPS/UPI |
|---|---|---|---|
| ≤ ₹1,000 | ₹3 | ₹4 | ₹6 |
| ₹1,000–₹25,000 | ₹5 | ₹6 | ₹8 |
| > ₹25,000 | ₹8 | ₹10 | ₹15 |

- **Cashgram:** ₹2.50 + transfer charges (Basic).
- **Secure ID:** pricing on request; ₹100 of free credits.
- **GST:** 18% on fees, deducted from settlement. TDR is deducted per transaction before settlement.
- **Refund fees:** not listed. Instant refunds carry a fee.

### 10.2 Server SDKs (official, from the docs SDK page)

| Language | Repo / package | Version |
|---|---|---|
| Node.js | `cashfree-pg` (github cashfree/cashfree-pg-sdk-nodejs) | 5.1.0 |
| Python | `cashfree_pg` (cashfree-pg-sdk-python) | 5.0.5 |
| Java | `com.cashfree` (cashfree-pg-sdk-java) | 5.0.1 |
| PHP | cashfree-pg-sdk-php | 5.0.3 |
| .NET | NuGet `cashfree-dotnet-pg` | 6.0.7 |
| Go | `github.com/cashfree/cashfree-pg/v3` (repo cashfree/cashfree-pg) | 5.1.9 |

SDK usage (Node v5):

```js
const { Cashfree, CFEnvironment } = require("cashfree-pg");
const cf = new Cashfree(CFEnvironment.SANDBOX, APP_ID, SECRET);
cf.PGCreateOrder(req); cf.PGFetchOrder(orderId); cf.PGOrderFetchPayments(orderId);
cf.PGOrderCreateRefund(orderId, body); cf.PGVerifyWebhookSignature(sig, rawBody, ts);
```

(Method names beyond PGCreateOrder, PGFetchOrder and PGVerifyWebhookSignature are unverified.)

- **Client SDKs:** JS v3 (`sdk.cashfree.com/js/v3/cashfree.js`, npm `@cashfreepayments/cashfree-js`), Android `com.cashfree.pg:api:2.6.1`, iOS, Flutter, React Native, Cordova, plus subscription checkout SDKs for each.
- **Other tooling:** Postman collections, OpenAPI specs, DevStudio (interactive playground), Discord developer community, "Cashfree Agent Skills" for AI coding assistants, and MCP/AI tooling (`tools-ai` docs).
- **Plugins (unverified list):** Shopify (app plus One Click Checkout), WooCommerce, Magento, OpenCart, PrestaShop, WHMCS, Wix, Zoho, Bubble, and others via the Apps section.

### 10.3 Security and compliance
- RBI-licensed Payment Aggregator (PA-PG). PCI DSS Level 1 service provider. Hosted, popup, inline and Elements integrations keep merchants out of PCI scope. S2S with raw cards requires the merchant to hold PCI DSS.
- **RBI card tokenisation (CoF):** Token Vault, network tokens, cryptograms, and PAR (`/utilities/pars`).
- **Merchant KYC:** RBI KYC Master Direction (beneficial owners, CKYC, V-CIP).
- **Webhook security:** HMAC-SHA256 with the secret, verification over the raw body, https only in production, dedupe, and prompt 200 responses. A security checklist doc exists. Cashfree does not publish webhook source IPs in the docs reviewed (unverified).
- **Domain and package whitelisting** for checkout. IP whitelisting or signature for Payouts and Secure ID.
- **Account security:** 2FA to generate or view production keys, and RBAC roles.
- **Fraud:** RiskShield (ML scoring, smart rules, blocklists, a FLAGGED state, and suspicious transaction review).
- **TPV** for regulated sectors (securities, mutual funds, NBFC).
- **Data retention via API:** current and previous financial year only.

---

## 11. Takeaways for opengateway

Design choices worth copying, or deliberately changing:

1. **Order → session → payment model.** The merchant creates an `order` on the server and gets a short-lived opaque `payment_session_id` that is safe to hand to the browser. Every attempt is a separate `payment` with its own ID. The order flips to PAID on the first success, and later successes are auto-refunded.
2. **Two clocks:** order expiry (window to start an attempt) and TTL (window for the in-flight attempt to finish). Late success after TTL becomes CANCELLED plus an auto-refund. This is a clean model for avoiding stranded money.
3. **Date-based API versioning** via the `x-api-version` header, with separately pinned webhook versions per endpoint and a dual-delivery migration path.
4. **Webhooks:** `type` discriminator, `event_time`, a `data` envelope, HMAC-SHA256 base64 over `timestamp + rawBody`, an idempotency hash header, an attempt counter, configurable retry policies, a logs UI with batch resend, and analytics (success rate and latency).
5. **Rate-limit headers** on every response, including a `type` (ip or app_id) dimension, plus a self-serve limit-increase workflow.
6. **Idempotency** via `x-idempotency-key` with a replay header, alongside natural keys (`order_id`, `refund_id`).
7. **Error envelope** `{message, code, type, help}` with a small, closed set of `type`s.
8. **Sandbox affordances:** magic VPAs (`testsuccess@gocash`, `testfailure@gocash`, 20+ failure modes), OTP `111000`, magic `refund_note` values, `/simulate` endpoints for payment, settlement and VBA status, and `order_note:"preauth_transaction"`.
9. **Dashboard IA to mirror:** Summary (Overview, Analytics) / Transactions (Payments, Orders, Refunds, Disputes, Suspicious) / Settlements / VBA / Payment Links / Apps / Customers / Products / RiskShield / Reports / Developers (API Keys, Logs and Alerts, Webhooks, Rate Limits, Whitelisting) / Downtimes / Settings (Payment Methods, Preferences, Bank Accounts, Checkout Customisation, Access Management).
10. **RBAC:** five default roles (Admin, Manager, Developer, Operations, Support) plus Owner, custom roles, and direct View/Manage permissions.

### Sandbox test data (quick reference)

- **Cards:** OTP `111000`, expiry `03/2028`, CVV `123`, name `Test`.
  - Visa debit `4706131211212123`; Visa credit `4576238912771450` or `4444333322221111`.
  - Mastercard credit `5105105105105100`; Mastercard debit `5409162669381034`.
  - RuPay debit `6074825972083818`.
  - Recurring (subscriptions): `4138674860000008`.
  - USD/international: `7000008313806604` (09/2027, 581).
- **Netbanking:** TEST Bank, code `3333`, API code `TESTR`.
- **UPI VPAs:** `testsuccess@gocash`, `testfailure@gocash`, `testinvalid@gocash`, `testuserdropped@gocash`, `testexpired@gocash`, `testinsufficientfunds@gocash`, `testbankdeclined@gocash`, `testtimeoutbank@gocash`, `testfraud@gocash`, `testinvalidpin@gocash`, `testriskflagged@gocash`, `testdeclineuser@gocash`, and more.
- **TPV:** account `1111222233`, IFSC `TEST0001234`, VPAs `testtpvsuccess@gocash` and `testtpvfail@gocash`.
- **Token Vault BINs:** Visa 470613, 457623, 436534, 415527, 466535. Mastercard 559423, 544405, 533983, 555219, 524877. Append 10 random digits.
- **Limits:** cardless EMI needs at least ₹1,000. PayPal and bank transfer are not supported in sandbox. Wallets use a single generic test wallet.

### Gaps / unverified
- The full per-section left-nav labels for Payment Forms and the Subscriptions dashboard, and exact button names there.
- Exact softPOS, incident, abandoned-checkout and Global Collections webhook `type` strings.
- Exact Elements event names and `cashfree.pay()` option names. Mobile SDK callback names for platforms other than Android.
- Retention window for the idempotency key. Webhook source IPs. Webhook delivery timeout.
- Method-to-rate mapping for some lines on the pricing page, and the current UPI/RuPay MDR treatment.
- Offer status enum values. Eligibility API request shapes for cardless EMI and pay later.
