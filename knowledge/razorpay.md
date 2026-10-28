# Razorpay: Reference Knowledge File (for opengateway)

> **Date of research:** 2026-10-23
> **Purpose:** A detailed reference on how Razorpay (India) works end to end: products, onboarding, dashboard, checkout, APIs, webhooks, errors, refunds, settlements, disputes, pricing, SDKs and security. It is meant to guide the design of **opengateway**, an open-source payment gateway inspired by Razorpay, PhonePe PG and Cashfree.
> **Docs snapshot:** Razorpay's machine-readable docs index (`llms.txt`, "Last Updated: 30 April 2026") and about 2,240 doc pages fetched from `https://razorpay.com/docs/build/llm-docs/**.md` on 2026-10-23. The pricing page was fetched live the same day.
> **Convention:** Anything marked **(unverified)** comes from general knowledge or inference and was not confirmed in the fetched docs. Amounts are in paise (the currency subunit) unless stated otherwise.

## Sources

Primary sources (all fetched 2026-10-23):

- Docs index: https://razorpay.com/docs/llms.txt
- API overview / conventions: https://razorpay.com/docs/api/understand/ and https://razorpay.com/docs/build/llm-docs/api/understand.md
- API authentication: https://razorpay.com/docs/build/llm-docs/api/authentication.md
- Errors: https://razorpay.com/docs/build/llm-docs/errors.md, `/errors/common.md`, `/errors/payments/list.md`, `/errors/payments/payment-methods-error-parameters.md`
- Payments API and entity: https://razorpay.com/docs/api/payments/ and `/api/payments/entity.md`, `/api/payments/capture.md`
- Orders API and entity: https://razorpay.com/docs/api/orders/ and `/api/orders/entity.md`, `/api/orders/create.md`
- Refunds: `/api/refunds/*.md`, `/payments/refunds.md`, `/payments/refunds/instant.md`, `/payments/refunds/normal.md`, `/payments/refunds/issue.md`
- Settlements: `/api/settlements/*.md`, `/payments/settlements.md`, `/payments/settlements/instant.md`, `/payments/settlements/dashboard.md`
- Disputes: `/api/disputes/*.md`, `/payments/disputes.md`, `/payments/disputes/dashboard.md`
- Webhooks: `/webhooks.md`, `/webhooks/all.md`, `/webhooks/setup-edit-payments.md`, `/webhooks/validate-test.md`, `/webhooks/best-practices.md`, `/webhooks/faqs.md`, `/webhooks/payments.md`
- Standard checkout: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
- Custom checkout: `/payments/payment-gateway/web-integration/custom/build-integration.md`
- Hosted checkout: `/payments/payment-gateway/web-integration/hosted/integration-steps.md`
- S2S JSON: `/payments/payment-gateway/s2s-integration/json/v1/build-integration/cards.md`, `.../upi/intent.md`
- Capture settings: `/payments/payments/capture-settings.md`; payment lifecycle: `/payments/payments.md`
- Dashboard: `/payments/dashboard.md`, `/payments/dashboard/razorpay-home.md`, `/payments/dashboard/account-settings*.md`, `/payments/dashboard/reports*.md`, `/payments/dashboard/test-live-modes.md`
- Onboarding/KYC: `/payments/set-up.md`, `/payments/account-activation-support.md`, `/payments/business-types-kyc-documents.md`
- Products: `/payments/payment-links*.md`, `/payments/payment-pages*.md`, `/payments/payment-button.md`, `/payments/qr-codes.md`, `/payments/subscriptions*.md`, `/payments/smart-collect.md`, `/payments/route.md`, `/payments/invoices*.md`, `/payments/offers.md`, `/payments/optimizer.md`, `/payments/magic-checkout.md`
- Payment methods: `/payments/payment-methods/upi.md`, `/emi.md`, `/pay-later.md`, `/cards/features/saved-cards.md`
- Security: `/security.md`
- Pricing: https://razorpay.com/pricing/
- Server SDKs: `/payments/server-integration.md`

(Paths that start with `/` are relative to `https://razorpay.com/docs/build/llm-docs`.)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Merchant Onboarding, KYC, Activation, Modes and API Keys](#2-merchant-onboarding-kyc-activation-modes-and-api-keys)
3. [Dashboard Walkthrough](#3-dashboard-walkthrough)
4. [Checkout UX](#4-checkout-ux)
5. [End-to-End Integration Flow](#5-end-to-end-integration-flow)
6. [API Reference](#6-api-reference)
7. [Webhooks](#7-webhooks)
8. [Errors, Rate Limits, Idempotency, Pagination](#8-errors-rate-limits-idempotency-pagination)
9. [Refunds, Settlements, Disputes](#9-refunds-settlements-disputes)
10. [Pricing, SDKs, Plugins](#10-pricing-sdks-plugins)
11. [Security and Compliance](#11-security-and-compliance)
12. [Design Takeaways for opengateway](#12-design-takeaways-for-opengateway)

---

## 1. Product Overview

Razorpay describes itself as a full-stack financial platform. It covers India, Southeast Asia (Malaysia, Singapore) and the USA, with 180+ payment methods, and holds an RBI Payment Aggregator – Cross Border (PA-CB) licence. The product line splits into **Payments** (collections), **RazorpayX / Banking Plus** (payouts, current accounts), **Payroll**, **POS**, **Partners** and **Engage** (loyalty).

Razorpay's own "Implementation Bundles" from `llms.txt`:

| Business type | Recommended stack |
|---|---|
| E-commerce | Payment Gateway + Magic Checkout + Instant Settlements |
| SaaS / subscription | Standard Checkout + Subscriptions API + Webhooks |
| Marketplaces | Route (split payments) + Escrow accounts + Payouts |
| BFSI / lending | Smart Collect + Recurring mandates + RazorpayX Payouts |

### 1.1 Payments product suite

| Product | What it does | Key entity / ID prefix | Notes |
|---|---|---|---|
| **Payment Gateway** | Accept online payments through Checkout (Standard, Custom, Hosted, S2S, mobile SDKs, plugins) | `order_`, `pay_` | Every payment should be tied to an Order. Payments without `order_id` cannot be captured and are auto-refunded. |
| **Payment Links** | Shareable links (`short_url`), sent by SMS or email. No website needed. Support expiry, partial payments, reminders, and UPI-only links. | `plink_` | Statuses: `created`, `partially_paid`, `paid`, `expired`, `cancelled` |
| **Payment Pages** | No-code hosted, branded pages built with a WYSIWYG editor and custom URL. Price fields can be Item with Quantity, Fixed Amount, or Customer Decides Amount. Custom input fields supported. | `pl_` (unverified) | States: Active / Inactive. Pricing: 0.2% + PG fee. |
| **Payment Button** | One line of embeddable code that renders a button and opens Checkout. Template-based. | `pl_` (unverified) | Same no-code pricing as Pages |
| **QR Codes** | UPI QR codes, static or dynamic, `single_use` or `multiple_use`, optionally fixed amount. Also Bharat QR (cards + UPI). | `qr_` | Statuses: `active`, `closed`. Must be enabled on request. |
| **Subscriptions** | Plan-based recurring billing with trials, upfront amounts, add-ons, offers, pause/resume, auto-invoicing and smart retries | `plan_`, `sub_`, `ao_` | Statuses: `created`, `authenticated`, `active`, `pending`, `halted`, `cancelled`, `completed`, `expired`, plus `paused` and `resumed` events |
| **Recurring Payments** (tokens / mandates) | Merchant-controlled recurring charges after a one-time authorisation (cards, eMandate, Paper NACH, UPI AutoPay, wallets) | `token_` | Uses `/v1/payments/create/recurring`. You decide when to charge. |
| **Smart Collect** (Virtual Accounts / Customer Identifiers) | On-demand virtual bank accounts (account number + IFSC) for NEFT/RTGS/IMPS. Smart Collect 2.0 adds a virtual UPI ID. TPV supported. | `va_` | Statuses: `active`, `closed` |
| **Route** | Split payments to Linked Accounts (marketplaces). Transfers, reversals, settlement holds. | `acc_`, `trf_`, `rvrsl_` | Since Sept 2025 RBI PA rules, Route needs a minimum turnover (domestic > ₹40 lakh) |
| **Invoices** | GST/non-GST invoices with line items (Items), sent by SMS/email, partial payments allowed | `inv_`, `item_` | Statuses: `draft`, `issued`, `partially_paid`, `paid`, `cancelled`, `expired`, `deleted` |
| **Customers** | Customer records (name, email, contact, gstin, notes) that hold saved cards and tokens | `cust_` | `fail_existing` flag on create |
| **Offers** | Discounts, cashback, No Cost EMI and Low Cost EMI offers shown on Checkout | `offer_` | Not supported on international currency or CFB |
| **EMI** | Credit card EMI, debit card EMI, cardless EMI, No Cost / Low Cost EMI, Bajaj Finserv. EMI² affordability widget. | — | Instant refunds not supported on EMI, Cardless EMI or Pay Later |
| **Pay Later** | BNPL providers (LazyPay and others) | — | OTP authorisation on Checkout |
| **Magic Checkout** | One-click e-commerce checkout. Saved addresses, prepaid + COD, RTO (return-to-origin) intelligence, coupons, shipping, "Login with Razorpay". | — | On-demand, enterprise pricing. Web, Android, iOS, Flutter, RN, Shopify, WooCommerce. |
| **Optimizer** | Routes payments across multiple gateways (PayU, Cashfree, Paytm, PhonePe, BillDesk, CCAvenue, etc.) through one integration, using rules and a smart router | — | On-demand, custom pricing |
| **Instant Settlements** | Settle balance on demand (T+0), 24x7, over IMPS. Smart Settlements over RTGS for large amounts. | `setlod_` (unverified) | On-demand. Fee per settlement. |
| **Instant Refunds** | Refund within minutes (`speed=optimum`) | `rfnd_` | Flat fee per refund |
| **Disputes** | Chargeback management: accept or contest with evidence documents | `disp_`, `doc_` | — |
| **TokenHQ** | Card tokenisation (network tokens), as Razorpay requestor or merchant requestor | — | RBI card-on-file compliance |
| **Turbo UPI** | In-app UPI without redirecting to a PSP app (SDK) | — | `upi.flow = in_app` in the payment entity |
| **TPAP Pro** | UPI TPAP as a service: VPA creation, mandates, UPI Lite, UPI number | — | Advanced |
| **POS** | Physical card/QR terminals (Razorpay POS, ePOS) | — | Separate MDR table |
| **Webstore**, **WhatsApp payments**, **Widgets**, **Mobile App**, **Razorpay.me** | Store builder, in-chat payments, affordability widgets, merchant mobile app | — | — |
| **International Payments** | International cards, PayPal, international APMs (Klarna, Alipay, Sofort, Trustly, etc.), multi-currency accounts, DCC | — | Settlement in INR. Currency subunit rules apply. |

### 1.2 RazorpayX (Banking / Payouts)

| Product | Endpoints | Notes |
|---|---|---|
| Contacts | `/v1/contacts` | Beneficiaries |
| Fund Accounts | `/v1/fund_accounts` | Types: `bank_account`, `vpa`, `card`, `wallet` |
| Payouts | `/v1/payouts` | Modes: IMPS/NEFT/RTGS/UPI. `X-Payout-Idempotency` header is **mandatory since 15 Mar 2025**. |
| Payout Links | `/v1/payout-links` | Beneficiary enters their own account details |
| Account Validation | `/v1/fund_accounts/validations` | Penny drop and reverse penny drop |
| Approval workflows | `/v1/payouts/:id/approve`, `/reject` | — |
| Transactions / Balance | `/v1/transactions`, `/v1/banking_balances` | — |

Payout states: `pending` (awaiting approval), `queued` (insufficient balance or bank down), `processing`/`initiated`, `processed`, `reversed`, `failed`, `rejected`, `cancelled`.

---

## 2. Merchant Onboarding, KYC, Activation, Modes and API Keys

### 2.1 Signup flow (Dashboard)

1. **Set Up Account**: email or 10-digit phone, password, OTP verification, then choose **business type**.
2. **Basic Details**: full name of the person onboarding, mobile + OTP, platforms where payments will be accepted (website/app/social), website or app links (can "Add later"), social media links, review.
3. **Business Details**: **Registered or Unregistered**, then business sub-type (Proprietorship, Partnership, Pvt Ltd, LLP, Trust, Society, etc.).
   - Unregistered individual: personal PAN (details are auto-fetched), confirm, choose brand name.
   - Registered: legal business name, personal PAN, date of incorporation, PAN confirm, brand name.
   - PAN required: individuals give the owner's PAN; registered businesses give business PAN plus authorised signatory PAN; proprietors give the proprietor's PAN.
4. **Business Documents** (registered businesses): at least **1 required** (GST certificate or MSME/UDYAM certificate) plus **1 additional** (Shop Establishment Certificate, Import Export Certificate, or mobile postpaid bill). Enter GSTIN, or tick "I don't have a GSTIN".
5. **KYC Details**:
   - **CKYC** (Central KYC, effective 1 Jan 2026): "Fetch details with PAN & OTP". Instant if CKYC records exist.
   - Fallbacks: **DigiLocker** Aadhaar (Aadhaar number, captcha, OTP, 6-digit DigiLocker PIN, consent) or **manual upload** (Aadhaar / Voter ID / Passport).
   - Business category and sub-category (drives MCC and default payment methods). Average delivery time and registered address are asked only if CKYC fails.
   - **Bank details**: Razorpay deposits ₹1 (penny drop) to verify. If that fails, upload bank proof such as a letter from the branch manager.
   - **Video KYC (VKYC)** for the authorised signatory where needed. Needs camera, mic and location, with no VPN or proxy. A shareable VKYC link can be sent to the signatory.
6. **Submit Application**. There is an optional "Unlock International" step.
7. Review by the Razorpay team. They may ask for clarifications on the Dashboard. When approved, **Live mode is enabled**.

Industry-specific certificates may be required: FSSAI (food), AYUSH, SEBI (investment advisory), FEMA/FFMC (forex), NBFC registration, BIS hallmark (jewellery), IRDA (insurance), AMFI (mutual funds), IATA (travel), DOT (telecom/OSP). A paid "Assisted Onboarding" manager is also offered. Periodic **Re-KYC** is required per RBI.

### 2.2 Account activation states

Taken from Partner sub-merchant webhooks (`account.*` / `product.payment_gateway.*`). These model the activation state machine:

| State | Meaning |
|---|---|
| `under_review` | Submitted, under Razorpay review |
| `needs_clarification` | More info or documents required |
| `activated_kyc_pending` | Can transact with limits; KYC still pending |
| `instantly_activated` | Instant activation (GMV-limited; `account.instant_activation_gmv_limit_warning`) |
| `activated` | Fully activated |
| `payments_enabled` | Payments enabled |
| `rejected` | Application rejected |
| `suspended` | Account suspended |
| funds on hold / unhold | Settlements held (`account.funds_hold`, `account.funds_unhold`) |

After full activation, the merchant can accept payments without amount limits, settlement runs on the cycle, and they can request extra payment methods and international payments.

### 2.3 Test mode vs Live mode

| | Test mode | Live mode |
|---|---|---|
| Availability | Right after signup, forever | After account activation |
| Money | Simulated, no real money | Real |
| Keys | `rzp_test_...` key id | `rzp_live_...` key id |
| Data | Entities are isolated from live (IDs don't cross over) | — |
| Bank page | Mock bank page with **Success** / **Failure** buttons | Real bank / PSP |
| Webhooks | Separate URLs per mode; test OTP `754081` for webhook edits | OTP to registered mobile |
| Toggle | Test Mode toggle in the Dashboard header | — |

**Test credentials:**

| Method | Test values |
|---|---|
| UPI | `success@razorpay`, `failure@razorpay` |
| Domestic cards | Visa `4100 2800 0000 1007`, Mastercard `5500 6700 0000 1002`, RuPay `6527 6589 0000 1005`, Diners `3608 280009 1007`, Amex `3402 560004 01007` (any future expiry, random CVV) |
| International cards | Visa `4012 8888 8888 1881`, Mastercard `5555 5555 5555 4444` |
| Netbanking / wallets | Pick any option, then click Success or Failure on the mock page |
| Need approval even in test | Cardless EMI, Bank Transfer, eMandate, Pay Later |

### 2.4 API keys

- An API key is a pair: `key_id` (public, used in Checkout) and `key_secret` (server only).
- Generate it at **Account & Settings → API Keys** (under *Website and app settings*) → **Generate Key**, for the currently selected mode.
- Live keys need verified **website/app details**. Test keys need no website.
- The secret is shown **only once** in a download popup. Afterwards the Dashboard shows only the Key ID.
- **One active key set per mode.** Keys are universal across all whitelisted websites/apps of the MID.
- **Regenerate / roll**: needs OTP or 2FA. You choose to deactivate the old key **immediately or after 24 hours**.
- RazorpayX keys: **My Account & Settings → Developer Controls → Generate Key**. Live mode needs OTP.
- Authorization header: `Authorization: Basic base64(key_id:key_secret)`. The scheme must be exactly `Basic ` (case-sensitive; `BASIC`, `basic` and quoted tokens are rejected).

---

## 3. Dashboard Walkthrough

Dashboard URL: `https://dashboard.razorpay.com` (login via `accounts.razorpay.com`). The top navigation switches between product suites (**Payments**, **Banking Plus/RazorpayX**, **Payroll**, **Partners**, and so on) through **Razorpay Home**.

### 3.1 Left navigation (Payments dashboard)

Reconstructed from doc navigation strings. Exact order and labels may vary by account, flags and over time.

| Section | Items |
|---|---|
| **Home** | Balance, last settlement, payments overview chart, insights, method split, AI assistant |
| **Transactions** | Tabs: **Payments**, **Refunds**, **Orders**, **Disputes**, **Success Rate** (also Batch Upload) |
| **Settlements** | Settlement list, **Settle Now** (instant), balance type filter, breakup |
| **Reports** | Download Report, Schedule Report, Downloads, Schedules, Custom reports |
| **PAYMENT PRODUCTS** | Payment Links, Payment Pages, Payment Button, QR Codes, Subscriptions (Plans / Subscriptions / Registration Links), Invoices (Invoices / Items), Smart Collect, Route (Linked Accounts / Transfers), Offers, Optimizer, Magic Checkout, Tokens, Webstore (unverified exact set) |
| **CUSTOMER PRODUCTS** | Customers (unverified label) |
| **Developers** | API logs, Webhook logs (Developers → APIs / Webhooks) |
| **Account & Settings** | Every configuration (see 3.10) |
| **Help / Support** | "Have a query?" → ticket categories |

### 3.2 Home

| Widget | Content |
|---|---|
| AI Assistant | Search plus quick actions: "Show me all recent failed payments", "Check the status of (refund ID / RRN)", "Lookup payment from screenshot" |
| Account Overview | **Current Balance**, **Last Settlement** (amount, status), settlement details with "view all" link |
| Key Updates | Feature announcements and action items (for example, funds on hold, international pending tasks) |
| Payments Overview | Collected amount, refunds, orders; interactive chart; date-range picker (default last 7 days) |
| Top Insights | Payment count, payment failure count, refund count, refund failure count, each with **View Details** |
| Payment Method Split | Credit cards / UPI / Netbanking / Others, as count + pie chart |
| Products for You | Cross-border, QR Code, Payment Links, POS promos |
| Razorpay Home (unified) | Critical alerts; quick actions (Transactions, Settlements, Payment Links, Reports, Payouts, A/c Statement); money in/out; Settlement A/c balance vs Current A/c balance with **View breakup**; Payment Insights (Payments Collected, Success Rate, Refunds, with time ranges Yesterday / Last Week / Last Month) |

### 3.3 Transactions → Payments

- **List columns** (unverified): Payment ID, Bank RRN, Order ID, Amount, Contact/Email, Created At, Status (captured/authorized/failed/refunded), Method.
- **Filters** (unverified, typical): Payment ID, Order ID, Status, Email, Contact, Notes, Method, Duration/date range, International. Plus **Export** / download.
- **Payment detail pane** (click Payment ID): amount, fee, tax, status timeline, method details (card network/last4, VPA, bank), customer contact/email, notes, order link, **settlement_id** link with breakup, refunds list.
- **Actions**:
  - **Capture Payment** (only for `authorized`) → dialog "**Yes, Capture**".
  - **Refund** → Refund Payment page: amount field (default full; lower for partial), **Refund Instantly** checkbox (shows instant-refund fee), then **Issue Full Refund** / **Issue Partial Refund**. Allowed only on `captured` payments.
  - View settlement details.

### 3.4 Transactions → Refunds

- Click **View All** on the Refunds tab to see the list. Click a Refund ID for details: status (`pending`/`processed`/`failed`), speed requested/processed, ARN/RRN (`acquirer_data`), and settlement_id breakup.
- **Batch Refunds**: upload XLSX/CSV. Processing is picked up **after 70 minutes**, and the batch can be cancelled within those 70 minutes.

### 3.5 Transactions → Orders

- **View All** on the Orders tab shows the list. Click an Order ID for details (amount, amount_paid, amount_due, attempts, status, linked payments). This screen is read-only.

### 3.6 Transactions → Disputes

- List of disputes. **Details** opens a right pane with reason code, phase, amount, respond-by, status.
- **Accept Dispute** → "**Yes, Accept**". Amount is deducted from balance; status becomes `lost`. Only for `open` disputes within respond-by.
- **Contest & upload evidence**: choose full or partial amount (**Edit**), **Explanation** text, **Supporting Evidence** (pick evidence type → upload PDF/PNG/JPG; multiple allowed) → **Submit Evidence**.
- **Download Disputes Report**.

### 3.7 Transactions → Success Rate

- Success-rate analytics by method, bank and so on, with failure analysis (top error reasons).

### 3.8 Settlements

- List of settlements (ID, amount, UTR, status, created). **Balance Type** filter: *Online (Domestic + International Cards)*, *In-Person* (POS), *Alternate Payment Method (International)*. Each channel has its own settlement schedule and history (segregated balances).
- **Details** gives the breakup: Payment, Refunds, Adjustments, Transfers, Fees, Tax, Net settled.
- **Settle Now** → Instant Settlements window (current balance, max daily withdrawal limit, withdrawable amount) → enter amount → **Next** → fee + tax + net popup → choose Instant vs Smart Settlement → **Settle Now**.
- Enable settlements placed **on hold**.

### 3.9 Reports

- **Download Report**: "What report is this?" (type + format CSV/XLS/XLSX), "What will you receive?" (time frame; **Custom**; Current/Previous Financial Year for Payments, Settlements and Settlement Recon; **max 95 days** for others), "Do you want this report in an email?" (recipients) → **Start Download** → track in **Downloads**.
- **Schedule Report**: name, type, format, data duration (T+1), frequency (daily/weekly/monthly), time of day, recipients → **Create Schedule**. Manage under **Schedules** (Open → **Edit Schedule**).
- Limit: **3 concurrent reports**.
- Standard reports:

| Product | Reports |
|---|---|
| Payment Gateway | Settlements, Payments, Combined Report, Orders, Refunds, Instant Refunds, Settlement Recon, Monthly Invoice |
| Route | Transfers, Reversals, Custom Transfers with Notes |
| Payment Links / Buttons / Pages | Payment Links, Payment Buttons, Payment Pages |
| Subscriptions | Subscriptions |
| QR Codes | QR Codes |
| International | Offshore Remittance |

### 3.10 Account & Settings

Grouped sections and sub-tabs:

| Group | Sub-tab | What you can do |
|---|---|---|
| Profile | Phone, Login email, Password | Edit (needs 2-step verification code); change only after full activation |
| Profile | **2-Step Verification** | Enable 2FA for the team (OTP + password) |
| **Website and app settings** | Business website/app details | Add or update URLs (needed for live keys) |
| | **API Keys** | Generate / Regenerate (old key: deactivate now or in 24h) |
| | **Webhooks** | **+ Add New Webhook**, Edit, Enable/Disable, Delete (see section 7) |
| Business | Account details, Business details, Customer support details, Activation details, GST details | View/update |
| | **Manage Team** | Invite user, update role, remove user, team 2FA |
| | Credits, Balances | View/add credits (fee credits, refund credits); add funds to balance for refunds |
| | Support tickets | Raise and track |
| **Payment and refund** | **Transaction limits** | Request higher per-transaction limit (domestic / international): required limit, reason (min 100 words), sample invoice |
| | **Payment Capture / Capture & Refund** | Automatic capture, auto-capture timeout, manual capture timeout, auto-refund speed |
| | Bank account details, Settlement details | Update settlement bank (re-verification); view cycle |
| | **Payment Methods** | View enabled methods; **Request** others (Under Review → Updated → Requested → activated). Live mode only. Owner/Admin/Manager only. About 10 working days. |
| | International payments | Enable; purpose code, IEC code, HS code; **FIRS** certificates |
| **Checkout settings** | **Branding** | Brand name (Owner/Admin), Theme colour HEX, logo (≤1 MB, square, ≥256×256 px), email field optional/mandatory/hidden |
| | **Checkout Styling** | Visual customisation |
| | **Checkout Features** | Default language, Collect email (Optional/Mandatory), **Flash Checkout** (saved cards), **Message Banner**, mandate summary screen |
| | **Payment Configuration** | Method display configuration (blocks / ordering) |
| | Configuration (legacy) | Theme colour, logo, language, email, flash checkout, saved cards, **fee bearer model** (merchant vs customer/CFB), international, notifications |
| Notifications | Email / SMS / WhatsApp | Toggle customer notifications |
| Payment Links | Reminders | Configure reminder schedule |

### 3.11 Team roles

| Role | Highlights |
|---|---|
| **Owner** | Everything: API keys, webhooks, team, brand name, activation form, transactions, settlements, disputes (accept/contest), capture settings, payment methods, capture, refunds, invoices/plans/subscriptions/CI/customers/pages/links, linked accounts, batch uploads, reports, mobile app, offers, OAuth apps, API/webhook logs |
| **Pseudo Owner** | Same as Owner (max 2 per account; assignment needs OTP/2FA; audit-logged); cannot delete the primary owner |
| **Admin** | Near-owner operational access (unverified details) |
| **Manager** | Ops + configuration such as payment methods |
| **Operations** | Day-to-day refunds and settlements |
| **Finance** | Reports, settlements (unverified details) |
| **ePos** | POS-only |
| **Dispute Manager** | Disputes only (cannot issue refunds) |
| **Support** | Read/support access |
| **View-Only (Auditor)** | View everything, no actions |

Team actions: Invite a registered user, Invite a new user, Accept invite, Update role, Remove user, Enable 2FA at team level.

### 3.12 Payment Products screens

| Screen | Main button(s) | Other actions | Filters |
|---|---|---|---|
| **Payment Links** | **+ Create Payment Link** (Standard or **UPI Payment Link**) | Cancel, Duplicate, Update (expiry, notes, reference), Resend notification (SMS/email), Send reminders, test pay | Payment Link Status, Payment Link ID, Batch ID, Reference ID, Customer Contact, Customer Email, Notes, Payment Link Type (Standard/UPI), Duration |
| **Payment Pages** | **+ Create Payment Page** → template → editor | Title (≤40 chars), description with rich text/images/video, social share icons, contact info, T&C, price fields (Item with Quantity / Fixed Amount / Customer Decides Amount, min/max), custom input fields, reorder, Pay button label, custom URL, expiry, stock. Activate/Deactivate. | Status (Active/Inactive) |
| **Payment Button** | **+ Create Payment Button** → template → editor | Copy embed code, deactivate | — |
| **QR Codes** | **Create QR Code** | Close, search, download image | Status, customer, etc. |
| **Subscriptions** | **Create Plan**, **Create Subscription**, Subscription Links | Pause, Resume, Cancel (now or at cycle end), Update (plan/quantity/schedule), link offers, add-ons | Status, plan, customer |
| **Invoices** | **+ Create Invoice** → draft: Invoice #, customer (or create new), issue date, expiry date, billing/shipping address, place of supply, line items (item, rate, qty, **Add Line Item**), customer notes (≤2048 chars), T&C (≤2048), Enable Partial Payments → **Save Invoice** (draft) or **Finalize and Issue** | Cancel, Resend (SMS/email), Delete draft. Items tab: create item with tax rate, cess, tax inclusive/exclusive, HSN (6-8) / SAC (2-6). | Status, customer, date |
| **Smart Collect** | Create Customer Identifier | Close, view payments, add receivers, allowed payers (TPV) | Search by CI ID, UTR, etc. |
| **Route** | Add Linked Account | Create transfers, reverse, hold/release settlements | — |
| **Offers** | Create Offer | Activate/deactivate | — |
| **Customers** | Create Customer | Edit, view tokens/saved cards | — |
| **Optimizer** | Add payment provider | Rules (create custom rule, priority, default rule), success rate, reconciliation | — |
| **Batch Upload** | Upload file | Refunds, payment links, etc. in bulk | — |

---

## 4. Checkout UX

### 4.1 Integration types

| Type | What it is | Script / endpoint | Who renders UI | PCI scope for merchant |
|---|---|---|---|---|
| **Standard Checkout** | Razorpay-hosted modal (iframe overlay) on the merchant page | `https://checkout.razorpay.com/v1/checkout.js`, `new Razorpay(options).open()` | Razorpay | Minimal (SAQ-A-like) |
| **Custom Checkout** | Merchant builds the full UI; `razorpay.js` submits payment data | `https://checkout.razorpay.com/v1/razorpay.js`, `razorpay.createPayment(data)` | Merchant | Higher; card data passes through merchant JS |
| **Hosted Checkout** | Full-page redirect: merchant POSTs a form to Razorpay | `POST https://api.razorpay.com/v1/checkout/embedded` with `key_id`, `name`, `description`, `image`, `order_id`, `amount`, `currency`, `method`, `prefill[...]`, `notes[...]`, `callback_url` (mandatory), `cancel_url` | Razorpay | Minimal |
| **S2S (Server-to-Server)** | Merchant server calls payment create APIs. JSON flow (`/v1/payments/create/json`) returns `next[]` actions; Redirect flow (`/v1/payments/create/redirect`); UPI (`/v1/payments/create/upi`); recurring (`/v1/payments/create/recurring`) | Merchant | **Full PCI DSS** for cards |
| **Mobile SDKs** | Android (`com.razorpay:checkout`, Custom UI `com.razorpay:customui`), iOS (`razorpay-pod`, `razorpay-customui-pod`), Flutter (`razorpay_flutter`), React Native (`react-native-razorpay`), Cordova, Capacitor | Razorpay or merchant | — |
| **WebView** | Standard checkout inside an app WebView with `callback_url`; UPI intent needs special handling on Android/iOS | Razorpay | — |
| **Quick Integration** | Auto-generated button (`data-*` attributes) (unverified details) | Razorpay | — |

### 4.2 Standard Checkout options object

| Option | Req | Type / details |
|---|---|---|
| `key` | Yes | Key ID |
| `amount` | Yes | Subunits (paise). For 3-decimal currencies (KWD/BHD/OMR) the last digit must be 0 (99.991 KD → `99990`). For zero-decimal currencies (JPY), pass as is. |
| `currency` | Yes | ISO code |
| `name` | Yes | Business name shown on checkout |
| `order_id` | Yes | From the Orders API |
| `description` | No | Must start with an alphanumeric character |
| `image` | No | Logo URL or base64 |
| `handler` | No | `function(response)` success callback |
| `callback_url` | No | Server URL that receives a POST on success (WebView/redirect flows) |
| `redirect` | No | `true` to redirect to `callback_url` |
| `prefill` | No | `name`, `email`, `contact` (`+{cc}{number}`, default +91), `method` (`card`/`netbanking`/`wallet`/`upi`/`emi`; only works if contact + email are prefilled) |
| `notes` | No | ≤15 key-value pairs, ≤256 chars each |
| `theme` | No | `color` (HEX), `backdrop_color` |
| `modal` | No | `backdropclose`, `escape` (true), `handleback` (true), `confirm_close` (false), `ondismiss` (fn), `animation` (true) |
| `readonly` | No | `contact`, `email`, `name` booleans |
| `hidden` | No | `contact`, `email` booleans |
| `retry` | No | `enabled` (true), `max_count` (recommended 4; not on web) |
| `timeout` | No | Seconds |
| `remember_customer` | No | Save cards (false) |
| `customer_id` | No | For saved cards / static bank transfer details |
| `recurring` | No | eMandate/recurring (false) |
| `subscription_id` | No | For Subscriptions |
| `subscription_card_change` | No | Allow card change (false) |
| `send_sms_hash` | No | Android OTP auto-read (SDK 1.5.9+) |
| `allow_rotation` | No | Android (SDK 1.6.4+) |
| `config.display.language` | No | `en`, `ben`, `hi`, `mar`, `guj`, `tam`, `tel` |
| `config.display` | No | `blocks` (custom groups of `instruments` such as `{method:'wallet', wallets:['payzapp']}`, `{method:'upi'}`, card issuers/networks, banks), `sequence: ['block.xyz', ...]`, `hide: [{method: 'emi'}]`, `preferences.show_default_blocks: true/false` |

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
var rzp1 = new Razorpay({
  key: "rzp_test_xxx", amount: "50000", currency: "INR", name: "Acme Corp",
  order_id: "order_9A33XWu170gUtm",
  handler: function (r) { /* POST r.razorpay_payment_id, r.razorpay_order_id, r.razorpay_signature to server */ },
  prefill: { name: "Gaurav Kumar", email: "gaurav@example.com", contact: "+919000090000" },
  theme: { color: "#3399cc" },
  modal: { ondismiss: function(){ /* user closed */ } }
});
rzp1.on('payment.failed', function (r) {
  // r.error.code, description, source, step, reason, metadata.order_id, metadata.payment_id
});
document.getElementById('rzp-button1').onclick = function(e){ rzp1.open(); e.preventDefault(); };
</script>
```

**Success response** (handler, or POST body to `callback_url`): `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`.
**Failure** (`payment.failed` event): `error{code, description, source, step, reason, metadata{order_id, payment_id}}`. Checkout stays open so the customer can retry.
**Common integration errors**: "The id provided does not exist" (order created with a different key/mode than checkout). "Blocked by CORS policy" (order was created from the browser; it must be created server-side).

### 4.3 Custom Checkout (razorpay.js)

```js
var razorpay = new Razorpay({ key: 'rzp_test_xxx', image: '...', redirect: true }); // or Razorpay.configure({...}) for globals
razorpay.once('ready', function(r){ console.log(r.methods); });   // enabled methods
razorpay.createPayment({
  amount: 1000, currency: 'INR', email: '...', contact: '+919876543210',
  order_id: 'order_CuEzONfnOI86Ab', method: 'netbanking', bank: 'HDFC', notes: {...}
});
razorpay.on('payment.success', fn);  razorpay.on('payment.error', fn);
```

`methods` response shape (also from `GET /v1/methods?key_id=`): `card`, `debit_card`, `credit_card`, `prepaid_card`, `card_networks {AMEX, DICL, MC, MAES, VISA, JCB, RUPAY, BAJAJ}`, `amex`, `netbanking {HDFC: "HDFC Bank", ...}`, `wallet {payzapp: true, ...}`, `emi`, `upi`, `cardless_emi []`, `paylater []`, `emi_subvention`, `emi_options {ICIC: [{duration, interest, subvention, min_amount}]}`.

`createPayment` fields by method:

| `method` | Extra fields |
|---|---|
| `card` / `emi` | `card{number, name, expiry_month (MM), expiry_year (YY), cvv}`, `emi_duration`. CVV is optional and should not be sent for tokenised cards. |
| `netbanking` | `bank` (4-char code, for example `HDFC`, `ICIC`, `UTIB`) |
| `wallet` | `wallet`: `payzapp` (default); on approval: `olamoney`, `phonepe`, `airtelmoney`, `mobikwik`, `jiomoney`, `amazonpay`, `paypal`, `phonepeswitch` |
| `upi` | `vpa` (collect; **deprecated from 28 Feb 2026** except exemptions) or `_[flow]=intent` (unverified param name) |
| `cardless_emi` | `provider`: `hdfc`, `icic`, `idfb`, `kkbk`, `zestmoney`, `earlysalary`, `walnut369` |
| `paylater` | `provider`: `lazypay`, `paypal`, ... |
| `emandate` | `bank_account{account_number, ifsc, name}` (+ `customer_id`, `recurring`) |
| any | `callback_url`, `redirect` |

### 4.4 S2S JSON flow

`POST /v1/payments/create/json`. Body: `amount`, `currency`, `order_id`, `email`, `contact`, `method`, `card{...}`, `ip`, `authentication{...}` (3DS2), `browser{...}` (3DS2 device data), `notes`, `callback_url`, `referrer`. The response has `razorpay_payment_id` and a `next[]` array of actions:

| `next.action` | Meaning |
|---|---|
| `redirect` | Send the customer to `url` (3DS/ACS or bank page). Example: `https://api.razorpay.com/pg_router/v1/payments/:id/authentication/redirect?key_id=...` |
| `otp_submit` | `POST /v1/payments/:id/otp/submit` with the OTP (native OTP) |
| `otp_resend` | `POST /v1/payments/:id/otp/resend` |
| `otp_generate` | Trigger OTP |
| `intent` | UPI intent deep link, for example `upi://pay?pa=...&pn=acme&tr=...&am=100&cu=INR&mc=5411` |
| `poll` | Poll `GET /v1/payments/:id` (or `/status`) until final |
| `submit_authentication_information` / `initiate_challenge_via_sdk` | 3DS2 challenge steps |

Other S2S helpers: `POST /v1/payments/validate/vpa`, `POST /v1/payments/calculate/fees` (customer fee bearer), `GET /v1/iins/:iin` (card IIN metadata), `POST /v1/payments/:id/authorize`, `/authenticate`.

### 4.5 Payment methods and UI flows

| Method | Checkout UI flow | Notes |
|---|---|---|
| **Cards** (credit/debit/prepaid, Visa/MC/RuPay/Amex/Diners/Maestro/JCB) | Enter number/expiry/CVV/name → "Save card as per RBI guidelines" checkbox → 3DS (bank ACS page or **native OTP** inside checkout) → result | 3DS2 supported. Native OTP / OTP auto-read (`send_sms_hash`). Saved cards need OTP login to Checkout, then CVV (CVV-less for tokenised cards). Corporate cards cost 2.15%. |
| **UPI Intent** | Mobile: list of UPI apps (GPay, PhonePe, Paytm, BHIM...) → app opens via `upi://pay` → enter UPI PIN → back to checkout, which polls | Recommended path. Turbo UPI = in-app SDK. |
| **UPI QR** | Desktop: dynamic QR shown in checkout with a timer; customer scans and pays; checkout polls | — |
| **UPI Collect** | Customer types VPA → collect request in PSP app → approve with PIN | **Deprecated per NPCI from 28 Feb 2026.** Exempt: MCC 6012/6211 (IPO/securities), iOS app and mobile web, mandate execute/modify/revoke, eRupi, PA-CB. |
| **Netbanking** | Choose bank (popular grid + dropdown, 72+ banks) → redirect to bank login → back | Corporate netbanking supported |
| **Wallets** | Choose wallet → wallet login/OTP → pay | PayZapp default; others on approval |
| **EMI** | Phone → EMI / No Cost EMI / Low Cost EMI → Credit / Debit / Cardless → bank → tenure → card details → pay | Bajaj Finserv EMI has platform charges |
| **Cardless EMI** | Phone → provider → OTP / eligibility → tenure → confirm | Approval needed |
| **Pay Later** | Contact → provider (LazyPay, etc.) → OTP → done | Approval needed |
| **Bank Transfer** | Checkout shows virtual account no. + IFSC (static per `customer_id`) → customer does NEFT/RTGS/IMPS | Uses Smart Collect |
| **eMandate / NACH / UPI AutoPay** | `recurring: true` with `customer_id` and a token order → authorisation | Recurring |
| **International** | Cards (DCC available), PayPal, APMs (Klarna, Alipay, Sofort, Trustly, Giropay, GrabPay...), Apple Pay, Google Pay cards | AVS for billing address |
| **COD** (Magic Checkout) | Cash on delivery option with RTO risk check | — |

**Checkout global UX features:** phone-first contact screen ("Login with Razorpay" / saved details), language switch, offers strip, message banner, retry on failure (`retry.enabled`), `confirm_close` prompt on dismiss, `timeout`, downtime-aware method ordering (`payment.downtime.*`), and Rainy-day handling.

### 4.6 Callbacks summary

| Mechanism | Fires when | Payload | Use for |
|---|---|---|---|
| `handler` (JS) | Payment success | `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature` | Instant UI confirmation, then verify on server |
| `payment.failed` (JS event) | Each failed attempt | `error{...}` | Show reason, let user retry |
| `modal.ondismiss` | User closes modal | — | Track abandonment |
| `callback_url` (POST) | Success (redirect/WebView/Hosted) | Same three fields (on error: `error[code]`, `error[description]`, ... form fields) (unverified exact error keys) | Server-side handling in redirect flows |
| Webhooks | Server-to-server, async | Event envelope | Source of truth for automation |

---

## 5. End-to-End Integration Flow

```
Merchant server                Browser / App                Razorpay                     Bank / NPCI
     |  POST /v1/orders  ------------------------------------> | order (status=created)
     | <------------------------------------------------------ | order_id
     |  render page w/ order_id -->|                            |
     |                             | checkout.js open() ------> |
     |                             | customer pays ------------> | ---- auth (3DS/PIN) ----> |
     |                             |                            | <------- authorized ----- |
     |                             | <-- handler(payment_id,    | payment: authorized
     |                             |      order_id, signature)  | (auto-capture -> captured; order -> paid)
     | <--- POST to /verify -------|                            |
     | verify HMAC; mark paid      |                            |
     | <==================== webhook payment.captured / order.paid (X-Razorpay-Signature) ======
     |                                                          | T+2 settlement -> settlement.processed
     |  POST /v1/payments/:id/refund ------------------------> | refund (pending->processed)
```

### Step-by-step

1. **Create an Order** (server, Basic auth): `POST /v1/orders` with `{amount, currency, receipt, notes, partial_payment, first_payment_min_amount}`. The order starts in status `created`.
2. **Open Checkout** with `key` + `order_id` (+ `amount`, `currency`, `name`, `prefill`, ...).
3. **Customer pays.** The payment goes `created` → `authorized` (or `failed`). The order goes `created` → `attempted`.
4. **Handler** receives the three fields. Send them to your server.
5. **Verify the signature** on the server:
   ```
   generated = hex(HMAC_SHA256(key_secret, order_id + "|" + razorpay_payment_id))
   valid     = constant_time_equals(generated, razorpay_signature)
   ```
   Use the `order_id` **stored on your server**, not the one returned by the client. The SDKs provide helpers: Node `validatePaymentVerification`, Go `utils.VerifyPaymentSignature`, PHP `$api->utility->verifyPaymentSignature`, Python `client.utility.verify_payment_signature`. For Subscriptions the payload is `razorpay_payment_id + "|" + subscription_id`. For Payment Links it is `payment_link_id|payment_link_reference_id|payment_link_status|razorpay_payment_id` (both unverified in this snapshot).
6. **Capture**:
   - **Auto-capture** is the default ("Capture all payments authorised within N", up to 3 days). Capture settings apply only to payments created with the Orders API.
   - **Manual**: `POST /v1/payments/:id/capture` with `{amount, currency}`. The amount must equal the authorised amount. Only `authorized` payments can be captured.
   - Payments not captured within **3 days** (or a custom timeout, min **12 minutes**) are **auto-refunded** (normal speed).
   - Direct-settlement merchants are always auto-captured.
   - When captured, the order becomes `paid` and accepts no more payments. It stays `paid` even after a refund.
7. **Webhooks**: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid` are the source of truth. Use them to handle **late authorisation**: Razorpay polls the bank for up to 3 days and a "failed" payment can later become `authorized`.
8. **Verify status** when needed: `GET /v1/payments/:id`, `GET /v1/orders/:id/payments`.
9. **Settlement**: captured payments minus fees, tax, refunds and adjustments settle T+2 working days into the KYC bank account (`settlement.processed`).
10. **Refunds**: `POST /v1/payments/:id/refund` (full or partial, `speed: normal|optimum`), then `refund.created` → `refund.processed` / `refund.failed`.

### Lifecycle tables

**Order × Payment states**

| Stage | Order | Payment | Meaning |
|---|---|---|---|
| I | `created` | `created` | Details submitted, not yet processed |
| II | `attempted` | `authorized` / `failed` | Attempt made |
| III | `paid` | `captured` | Captured; order closed |

**Payment state machine**

```
created --(bank auth ok)--> authorized --(capture: auto/manual)--> captured --(full refund)--> refunded
   |                           |                                      \--(partial refund: stays captured, refund_status=partial)
   \--(fail/timeout)--> failed  \--(not captured in 3 days)--> refunded (auto)
failed --(late authorisation, up to 3 days)--> authorized
```

`refund_status`: `null` | `partial` | `full`. `captured: bool`. `amount_refunded`.

---

## 6. API Reference

### 6.1 Conventions

| Item | Value |
|---|---|
| Base URL | `https://api.razorpay.com/v1` (Partner/Route account APIs use `/v2`) |
| Auth | HTTP Basic: `key_id:key_secret`. OAuth bearer tokens for partner apps. |
| Format | JSON request/response; `content-type: application/json` |
| Success | HTTP 200 (docs say all successful responses return 200) |
| Errors | 4xx/5xx with `{"error": {...}}`; 429 for throttling |
| IDs | 14-char alphanumeric, case-sensitive, with prefix (`pay_`, `order_`, `rfnd_`, `cust_`, `token_`, `plink_`, `qr_`, `sub_`, `plan_`, `inv_`, `item_`, `va_`, `trf_`, `acc_`, `disp_`, `doc_`, `setl_`, `batch_`) |
| Entity envelope | Every object has `id` and `entity`. Collections: `{"entity":"collection","count":N,"items":[...]}`. |
| Amounts | Integer subunits; currency ISO-3 |
| Timestamps | Unix seconds (`created_at`) |
| `notes` | ≤15 key-value pairs, ≤256 chars each; free-form, never used operationally |
| `expand[]` | Inline related entities, for example `?expand[]=card`, `emi`, `offers`, `payments`, `payments.card`, `transfers`, `recipient_settlement`, `transaction.settlement` |
| Versioning | Backwards compatible; deprecations announced. Only `v1`/`v2` in path. |
| TLS | TLS 1.2+ only (1.0/1.1 rejected) |
| DNS | Honour TTLs; don't cache DNS aggressively |
| CLI / MCP | Razorpay CLI (`razorpay refunds create ... --idempotency-key`), MCP server, n8n node, Postman workspace |

### 6.2 Orders

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/orders` | Create |
| GET | `/v1/orders` | List (`count`, `skip`, `from`, `to`, `authorized`, `receipt`, `expand[]=payments`/`payments.card`) |
| GET | `/v1/orders/:id` | Fetch |
| GET | `/v1/orders/:id/payments` | Payments for order |
| PATCH | `/v1/orders/:id` | Update `notes` only |

Create body: `amount`*, `currency`*, `receipt` (≤40 chars, unique), `notes`, `partial_payment` (bool), `first_payment_min_amount`. Variants: `method`/`bank_account` (TPV / eMandate), `payment_capture` (legacy per-order auto-capture flag, unverified current status), `transfers[]` (Route), `customer_id` + `token{...}` (recurring), `offers`.
Entity: `id`, `entity`, `amount`, `amount_paid`, `amount_due`, `currency`, `receipt`, `offer_id`, `status` (`created`|`attempted`|`paid`), `attempts`, `notes`, `created_at`.

### 6.3 Payments

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/payments` | List (`from`, `to`, `count`≤100, `skip`, `expand[]=card`/`emi`) |
| GET | `/v1/payments/:id` | Fetch (`expand[]=card`/`emi`/`offers`) |
| POST | `/v1/payments/:id/capture` | Capture `{amount, currency}` |
| PATCH | `/v1/payments/:id` | Update `notes` |
| GET | `/v1/payments/:id/card` | Card details |
| GET | `/v1/payments/:id/bank_transfer` | Bank transfer details |
| GET | `/v1/payments/:id/upi_transfer` | UPI transfer details (Smart Collect 2.0) |
| POST | `/v1/payments/:id/refund` | Create refund |
| GET | `/v1/payments/:id/refunds` | List refunds of payment |
| GET | `/v1/payments/:pid/refunds/:rid` | Fetch specific refund |
| POST | `/v1/payments/:id/transfers` | Route transfer from payment |
| GET | `/v1/payments/:id/transfers` | Transfers of payment |
| GET | `/v1/payments/downtimes`, `/v1/payments/downtimes/:id` | Method/bank downtime info |
| POST | `/v1/payments/create/json`, `/create/redirect`, `/create/upi`, `/create/recurring`, `/create/nach/file` | S2S payment creation |
| POST | `/v1/payments/:id/otp/submit`, `/otp/resend` | Native OTP |
| POST | `/v1/payments/validate/vpa` | VPA validation |
| POST | `/v1/payments/calculate/fees` | Fee calc (CFB) |
| GET | `/v1/methods?key_id=` | Enabled methods |
| GET | `/v1/iins/:iin` | Card BIN info |
| POST | `/v1/cards/fingerprints` | Card reference number from card number / token |

**Payment entity:** `id`, `entity:"payment"`, `amount`, `currency`, `base_amount`, `status` (`created`|`authorized`|`captured`|`refunded`|`failed`), `order_id`, `invoice_id`, `international`, `method` (`card`|`netbanking`|`wallet`|`emi`|`upi`, plus `cardless_emi`, `paylater`, `bank_transfer`, `emandate`, `nach`, `app`), `amount_refunded`, `amount_transferred`, `refund_status` (`null`|`partial`|`full`), `captured`, `description`, `card_id`, `card{id, entity:"card", name, last4, network (Visa, MasterCard, RuPay, American Express, Diners Club, Maestro, Unknown), type (credit|debit|prepaid|unknown), issuer (4-char bank code), international, emi, sub_type (consumer|business), token_iin}`, `bank` (e.g. `HDFC`, `UTIB`), `wallet`, `vpa`, `upi{payer_account_type (bank_account|credit_card|wallet), vpa, flow ("in_app" for Turbo)}`, `email`, `contact`, `customer_id`, `token_id`, `notes`, `fee` (incl. GST), `tax` (GST), `error_code`, `error_description`, `error_source`, `error_step`, `error_reason`, `acquirer_data{rrn, auth_code, arn, authentication_reference_number, bank_transaction_id, upi_transaction_id}`, `emi_plan`, `offer_id`, `created_at`.

### 6.4 Refunds

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/payments/:id/refund` | Create (normal or instant) |
| GET | `/v1/refunds` | List all |
| GET | `/v1/refunds/:id` | Fetch |
| PATCH | `/v1/refunds/:id` | Update `notes` |
| GET | `/v1/payments/:id/refunds` | Refunds for a payment |
| GET | `/v1/payments/:pid/refunds/:rid` | Specific refund |

Body: `amount` (default full), `speed` (`normal` default | `optimum` = instant where possible), `notes`, `receipt`. Header `X-Refund-Idempotency: <key>` (optional; ≥10 chars; `[A-Za-z0-9_-]`).
Entity: `id` (`rfnd_`), `entity:"refund"`, `amount`, `currency`, `payment_id`, `notes`, `receipt`, `acquirer_data{arn|rrn|utr}`, `created_at`, `batch_id`, `status` (`pending`|`processed`|`failed`), `speed_requested`, `speed_processed` (`instant`|`normal`).

### 6.5 Settlements

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/settlements` | List |
| GET | `/v1/settlements/:id` | Fetch |
| GET | `/v1/settlements/recon/combined?year=&month=[&day=]` | Recon line items (payments, refunds, adjustments, transfers per settlement) |
| POST | `/v1/settlements/ondemand` | Create instant settlement `{amount, settle_full_balance, description, notes}` |
| GET | `/v1/settlements/ondemand[/:id]` | List/fetch (`expand[]=ondemand_payouts`) |

Entity: `id` (`setl_`), `entity:"settlement"`, `amount`, `status` (`created`|`processed`|`failed`), `fees`, `tax`, `utr`, `created_at`.
Instant settlement entity: `amount_requested`, `amount_settled`, `amount_pending`, `amount_reversed`, `fees`, `tax`, `currency`, `settle_full_balance`, `status` (`created`|`initiated`|`partially_processed`|`processed`|`reversed`), `ondemand_payouts[]`.

### 6.6 Customers and Tokens

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/customers` | Create `{name, email, contact, gstin, notes, fail_existing: "1"|"0"}` |
| GET | `/v1/customers` | List |
| GET | `/v1/customers/:id` | Fetch |
| PUT | `/v1/customers/:id` | Edit |
| GET | `/v1/customers/:id/tokens` | List saved tokens (cards/mandates) |
| GET | `/v1/customers/:id/tokens/:token_id` | Fetch token |
| DELETE | `/v1/customers/:id/tokens/:token_id` | Delete token |
| POST | `/v1/customers/:id/tokens/:token_id/cancel` | Cancel recurring token |
| POST | `/v1/tokens/fetch`, `/v1/tokens/delete`, `/v1/tokens` | TokenHQ token APIs |
| — | Bank accounts / fund accounts on customer | `/api/customers/bank-accounts`, `customer-fund-account` |

Customer entity: `id` (`cust_`), `name`, `email`, `contact`, `gstin`, `notes`, `shipping_address`, `created_at`.
Token (recurring) statuses, from webhooks: `initiated`, `confirmed`, `rejected`, `cancelled`, `paused`, `resumed`, `activated`, `deactivated`, `suspended`, `cancellation_initiated`, `expiry_updated`, plus card network token service-provider statuses.

### 6.7 Payment Links

| Method | Path |
|---|---|
| POST | `/v1/payment_links` (Standard; UPI link with `upi_link: true`) |
| GET | `/v1/payment_links` (filters `payment_id`, `reference_id`) |
| GET | `/v1/payment_links/:id` |
| PATCH | `/v1/payment_links/:id` (`reference_id`, `expire_by`, `notes`, `accept_partial`, `reminder_enable`) |
| POST | `/v1/payment_links/:id/cancel` |
| POST | `/v1/payment_links/:id/notify_by/:medium` (`sms` / `email`) |

Create body: `amount`*, `currency`, `accept_partial`, `first_min_partial_amount`, `upi_link`, `description`, `reference_id` (unique), `customer{name, email, contact}`, `expire_by`, `notify{sms, email}`, `notes`, `callback_url`, `callback_method` (`get`), `reminder_enable`. Advanced `options.checkout{...}` covers theme, business name, method config, labels, offers, TPV (`options.order.bank_account`) and Route `transfers`.
Entity: `id` (`plink_`), `amount`, `amount_paid`, `currency`, `accept_partial`, `first_min_partial_amount`, `customer`, `description`, `expire_by`, `expired_at`, `cancelled_at`, `notify`, `notes`, `payments[]`, `reference_id`, `reminder_enable`, `short_url` (`https://rzp.io/i/...`), `status` (`created`|`partially_paid`|`paid`|`expired`|`cancelled`), `upi_link`, `user_id`, `created_at`, `updated_at`.

### 6.8 QR Codes

| Method | Path |
|---|---|
| POST | `/v1/payments/qr_codes` |
| GET | `/v1/payments/qr_codes` (`customer_id`, `payment_id`, `count`...) |
| GET | `/v1/payments/qr_codes/:id` |
| GET | `/v1/payments/qr_codes/:id/payments` |
| PATCH | `/v1/payments/qr_codes/:id` |
| POST | `/v1/payments/qr_codes/:id/close` |

Create body: `type`* (`upi_qr`; `bharat_qr` for cards+UPI), `name`, `usage`* (`single_use`|`multiple_use`), `fixed_amount`, `payment_amount` (if fixed), `description`, `customer_id`, `close_by`, `notes`. Variants: GST on UPI QR, image content (custom image).
Entity: `id` (`qr_`), `entity:"qr_code"`, `name`, `usage`, `type`, `image_url`, `payment_amount`, `status` (`active`|`closed`), `description`, `fixed_amount`, `payments_amount_received`, `payments_count_received`, `notes`, `customer_id`, `close_by`, `closed_at`, `close_reason` (`on_demand`|`paid` (unverified)), `created_at`.

### 6.9 Subscriptions, Plans, Add-ons

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/plans` | Create plan `{period*: daily|weekly|monthly|quarterly|yearly, interval*, item*{name, amount, currency, description}, notes}` |
| GET | `/v1/plans`, `/v1/plans/:id` | List / fetch |
| POST | `/v1/subscriptions` | Create `{plan_id*, total_count*, quantity, start_at, expire_by, customer_notify, addons[{item{name, amount, currency}}], offer_id, notes}` (+ `notify_info` for subscription links) |
| GET | `/v1/subscriptions`, `/v1/subscriptions/:id` | List / fetch |
| PATCH | `/v1/subscriptions/:id` | Update (plan_id, quantity, remaining_count, start_at, schedule_change_at `now`/`cycle_end`) |
| GET | `/v1/subscriptions/:id/retrieve_scheduled_changes` | Pending update |
| POST | `/v1/subscriptions/:id/cancel_scheduled_changes` | Cancel pending update |
| POST | `/v1/subscriptions/:id/pause` | `{pause_at: "now"}` |
| POST | `/v1/subscriptions/:id/resume` | `{resume_at: "now"}` |
| POST | `/v1/subscriptions/:id/cancel` | `{cancel_at_cycle_end: 0|1}` |
| POST | `/v1/subscriptions/:id/addons` | Create add-on (charged with next invoice) |
| GET/DELETE | `/v1/addons[/:id]` | List / fetch / delete add-on |
| DELETE | `/v1/subscriptions/:sub_id/:offer_id` | Remove offer |
| GET | `/v1/invoices?subscription_id=` | Subscription invoices |

Subscription entity: `id` (`sub_`), `plan_id`, `customer_id`, `status`, `current_start`, `current_end`, `ended_at`, `quantity`, `notes`, `charge_at`, `start_at`, `end_at`, `auth_attempts`, `total_count`, `paid_count`, `remaining_count`, `customer_notify`, `expire_by`, `short_url`, `has_scheduled_changes`, `change_scheduled_at`, `offer_id`, `payment_method`, `created_at`.

Status flow:
```
created --auth txn--> authenticated --billing starts--> active --charge fails--> pending --retries exhausted--> halted
   |                                                       ^  |                     |                        |
   |                                                       |  +--> paused --resume--+                        |
   +--expire_by passed--> expired                          +-------- card changed / manual charge ok --------+
active --all cycles billed--> completed     any --cancel--> cancelled
```
Trial = `start_at` in the future (auth now, charge later). Upfront amount = add-on charged during authentication. In `halted`, invoices keep generating but are not auto-charged. When the subscription returns to active, only future invoices are charged.

### 6.10 Invoices and Items

| Method | Path |
|---|---|
| POST | `/v1/invoices` (with `customer_id` or inline `customer{...}`) |
| GET | `/v1/invoices`, `/v1/invoices/:id` |
| PATCH | `/v1/invoices/:id` (draft only for most fields) |
| POST | `/v1/invoices/:id/issue` |
| POST | `/v1/invoices/:id/cancel` |
| DELETE | `/v1/invoices/:id` (draft) |
| POST | `/v1/invoices/:id/notify_by/:medium` |
| POST/GET/PATCH/DELETE | `/v1/items`, `/v1/items/:id` |

Create body: `type`* (`invoice`), `description`, `draft` (`1` to keep as draft), `customer_id` / `customer{name, email, contact, billing_address{line1, line2, city*, zipcode*, state*, country*}, shipping_address{...}}`, `line_items[{item_id | name, description, amount, currency, quantity}]`, `expire_by`, `sms_notify`, `email_notify`, `partial_payment`, `currency`, `notes`.
Entity: `id` (`inv_`), `type`, `invoice_number`, `customer_id`, `customer_details`, `order_id`, `line_items`, `payment_id`, `status` (`draft`|`issued`|`partially_paid`|`paid`|`cancelled`|`expired`|`deleted`), `expire_by`, `issued_at`, `paid_at`, `cancelled_at`, `expired_at`, `sms_status`, `email_status`, `partial_payment`, `amount`, `amount_paid`, `amount_due`, `currency`, `description`, `notes`, `short_url`, `date`, `terms`, `comment`.
Item entity: `id` (`item_`), `active`, `name`, `description`, `amount`, `currency`, `unit_amount`, `type`, `unit`, `tax_inclusive`, `hsn_code`, `sac_code`, `tax_rate`, `tax_id`, `tax_group_id`, `created_at`.

### 6.11 Smart Collect (Virtual Accounts / Customer Identifiers)

| Method | Path |
|---|---|
| POST | `/v1/virtual_accounts` |
| GET | `/v1/virtual_accounts`, `/v1/virtual_accounts/:id` |
| PATCH | `/v1/virtual_accounts/:id` |
| POST | `/v1/virtual_accounts/:id/close` |
| GET | `/v1/virtual_accounts/:id/payments` |
| POST | `/v1/virtual_accounts/:id/receivers` (add `bank_account` or `vpa`) |
| POST/DELETE | `/v1/virtual_accounts/:va_id/allowed_payers[/:id]` (TPV) |
| GET | `/v1/payments?va_transaction_id=<UTR>&virtual_account=1` (find payment by UTR) |

Create body: `receivers*{types: ["bank_account","vpa"], bank_account{descriptor}, vpa{descriptor}}`, `description`, `customer_id`, `notes`, `close_by`, `allowed_payers[]` (TPV).
Entity: `id` (`va_`), `name`, `status` (`active`|`closed`), `description`, `amount_expected`, `amount_paid`, `notes`, `customer_id`, `receivers[{id, entity: bank_account|vpa, ifsc, bank_name, account_number, name | username, handle, address}]`, `close_by`, `closed_at`, `created_at`.

### 6.12 Route (Linked Accounts, Transfers)

| Method | Path | Purpose |
|---|---|---|
| POST | `/v2/accounts` | Create linked account (`type: route`) |
| GET/PATCH | `/v2/accounts/:account_id` | Fetch / update |
| POST/PATCH | `/v2/accounts/:id/stakeholders[/:sid]` | Stakeholders |
| POST/GET/PATCH | `/v2/accounts/:id/products[/:pid]` | Product config (`route`), settlement bank details |
| POST | `/v1/orders` with `transfers[]` | Transfers from order |
| POST | `/v1/payments/:id/transfers` | Transfers from captured payment |
| POST | `/v1/transfers` | Direct transfer from balance `{account, amount, currency, notes}` (header `X-Transfer-Idempotency`) |
| GET | `/v1/transfers/:id`, `/v1/transfers?recipient_settlement_id=`, `?expand[]=recipient_settlement` | Fetch |
| PATCH | `/v1/transfers/:id` | `{on_hold, on_hold_until}` |
| POST/GET | `/v1/transfers/:id/reversals` | Reverse `{amount, notes}` / list |
| POST | `/v1/payments/:id/refund` with `reverse_all: 1` | Refund + reverse transfers |
| GET | `/v1/payments` with header `X-Razorpay-Account: acc_...` | Linked account's payments (unverified header) |

Transfer item: `account`*, `amount`*, `currency`*, `notes`, `linked_account_notes[]`, `on_hold` (bool), `on_hold_until` (unix).
Transfer entity: `id` (`trf_`), `transfer_status` (`created`|`pending`|`processed`|`failed`|`reversed`|`partially_reversed`), `settlement_status` (`pending`|`on_hold`|`settled`), `source` (`pay_`/`order_`), `recipient` (`acc_`), `amount`, `currency`, `amount_reversed`, `notes`, `error{code, description, field, source, step, id, reason}`, `linked_account_notes`, `on_hold`, `on_hold_until`, `recipient_settlement_id`, `created_at`.
Linked account `status`: `created` | `suspended`. Activation via `product.route.under_review` / `needs_clarification` / `activated`.

### 6.13 Disputes and Documents

| Method | Path |
|---|---|
| GET | `/v1/disputes` |
| GET | `/v1/disputes/:id` (`expand[]=payment`, `transaction.settlement`) |
| POST | `/v1/disputes/:id/accept` |
| PATCH | `/v1/disputes/:id/contest` |
| POST | `/v1/documents` (multipart `file`, `purpose: dispute_evidence`) |
| GET | `/v1/documents/:id`, `/v1/documents/:id/content` |

Contest body: `amount`, `summary` (≤1000 chars), evidence doc-id lists (`shipping_proof`, `billing_proof`, `cancellation_proof`, `customer_communication`, `proof_of_service`, `explanation_letter`, `refund_confirmation`, `access_activity_log`, `refund_cancellation_policy`, `term_and_conditions`, `others[{type, document_ids}]`), `action` (`draft` default | `submit`; submit needs at least 1 doc and moves `open` → `under_review`).
Entity: `id` (`disp_`), `payment_id`, `amount`, `currency`, `amount_deducted`, `reason_code`, `reason_description`, `respond_by`, `status` (`open`|`under_review`|`won`|`lost`|`closed`), `phase` (`fraud`|`retrieval`|`chargeback`|`pre_arbitration`|`arbitration`), `evidence{..., submitted_at}`, `created_at`.

### 6.14 Recurring payments (tokens / mandates)

1. Create a customer.
2. Create an order with `customer_id`, `method` (`card` | `emandate` | `nach` | `upi`), `token{max_amount, expire_at, frequency, auth_type, bank_account{...}}`. Amount is ₹0 or ₹1 for eMandate auth (unverified exact amounts).
3. Authorisation payment through Checkout (`recurring: true`), or S2S `/v1/payments/create/recurring`.
4. The token is confirmed (`token.confirmed`).
5. Subsequent charges: create a new order, then `POST /v1/payments/create/recurring` with `{email, contact, amount, currency, order_id, customer_id, token, recurring: "1"}`.

Methods: Cards (RBI e-mandate; pre-debit notification), eMandate (NetBanking/Aadhaar), Paper NACH (upload form `/v1/payments/create/nach/file`), UPI AutoPay (intent / OTM / TPV / Reserve Pay), Wallets.

---

## 7. Webhooks

### 7.1 Setup

- Path: **Account & Settings → Webhooks** (under *Website and app settings*) → **+ Add New Webhook**.
- Fields: **Webhook URL** (HTTPS recommended; public only; ports **80/443**; no `razorpay` domain; no localhost/private IP; blacklisted tunnel/bin domains such as ngrok.io, webhook.site, requestbin.com, loca.lt, beeceptor.com, hookbin.com, mockbin.org, burpcollaborator.net, interact.sh, oast.pro, canarytokens.com, `.local`, `.internal`, `.corp`, `.onion`, metadata.google.internal), **Secret** (optional but recommended; separate from the API key secret), **Alert Email** (failures and deactivation), **Active Events** checklist → **Create Webhook**.
- Up to **30 webhook URLs** for Payments. RazorpayX: 1 per MID.
- Separate configuration for Test and Live. Test-mode OTP: `754081`.
- Edit (URL / secret / alert email / events) → **Save Webhook**. Enable/Disable toggle. Delete → **Yes, Delete**.
- Logs: **Developers → Webhooks** → select webhook to see delivery history.
- Recommended local testing tunnel: `zrok`.
- Whitelist Razorpay webhook source IPs.

### 7.2 Delivery semantics

| Aspect | Behaviour |
|---|---|
| Method | HTTP POST, JSON body |
| Success | Any **2xx within 5 seconds** |
| Failure | Non-2xx or timeout |
| Retries | Exponential backoff for **24 hours** from event creation |
| Auto-disable | If still failing after 24h, the webhook is **disabled** and an email goes to the alert email (or account email). Must be re-enabled manually. |
| Delivery guarantee | **At-least-once**. Duplicates are possible. |
| Ordering | **Not guaranteed** (for example, `payment.captured` may arrive before `payment.authorized`) |
| Dedup | Header `x-razorpay-event-id` (unique per event) |
| Payload | **Snapshot** of the entity at event time |
| Replay | Via support ticket, if ≤15 days old and the webhook was enabled at the time; no bulk replay |
| TLS | 1.2+ on receiver |

### 7.3 Signature verification

```
X-Razorpay-Signature = hex(HMAC_SHA256(key = webhook_secret, message = RAW_REQUEST_BODY))
```

- Use the **raw body**. Do not parse and re-serialise it.
- After rotating the secret, retries of older events are still signed with the **old** secret.
- SDK helpers: PHP `$api->utility->verifyWebhookSignature($body, $sig, $secret)`, Python `client.utility.verify_webhook_signature`, Ruby `Razorpay::Utility.verify_webhook_signature`, .NET/Java `Utils.verifyWebhookSignature`, Node `validateWebhookSignature(body, sig, secret)` from `razorpay/dist/utils/razorpay-utils`.

### 7.4 Envelope

```json
{
  "entity": "event",
  "account_id": "acc_BFQ7uQEaa7j2z7",
  "event": "payment.captured",
  "contains": ["payment"],
  "payload": { "payment": { "entity": { "id": "pay_...", "status": "captured", "...": "..." } } },
  "created_at": 1567674606
}
```
`contains` lists the payload keys (for example, `["payment","order"]` for `order.paid`, `["refund","payment"]` for refunds, `["payment","qr_code"]`, `["payment","virtual_account","bank_transfer"]`).

### 7.5 Full event list

| Area | Events |
|---|---|
| Orders | `order.paid`, `order.notification.delivered`, `order.notification.failed` |
| Payments | `payment.authorized`, `payment.captured`, `payment.failed`, `payment.pending` |
| Payment downtime | `payment.downtime.started`, `payment.downtime.updated`, `payment.downtime.resolved` |
| Refunds | `refund.created`, `refund.processed`, `refund.failed`, `refund.speed_changed` |
| Disputes | `payment.dispute.created`, `payment.dispute.won`, `payment.dispute.lost`, `payment.dispute.closed`, `payment.dispute.under_review`, `payment.dispute.action_required` |
| Settlements | `settlement.processed` (+ instant: `settlement.ondemand*` variants, unverified exact names) |
| Invoices | `invoice.partially_paid`, `invoice.paid`, `invoice.expired` |
| Subscriptions | `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.completed`, `subscription.updated`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.paused`, `subscription.resumed` |
| Payment Links | `payment_link.paid`, `payment_link.partially_paid`, `payment_link.cancelled`, `payment_link.expired` |
| QR Codes | `qr_code.created`, `qr_code.credited`, `qr_code.closed` |
| Smart Collect | `virtual_account.created`, `virtual_account.credited`, `virtual_account.closed` |
| Route | `transfer.processed`, `transfer.failed`, `product.route.under_review`, `product.route.needs_clarification`, `product.route.activated` |
| Tokens (recurring / TokenHQ) | `token.initiated`, `token.confirmed`, `token.rejected`, `token.paused`, `token.resumed`, `token.cancelled`, `token.cancellation_initiated`, `token.activated`, `token.deactivated`, `token.suspended`, `token.expiry_updated`, `token.service_provider.activated`, `token.service_provider.deactivated`, `token.service_provider.cancelled`, `token.service_provider.failed` |
| Partner / sub-merchant accounts | `account.under_review`, `account.needs_clarification`, `account.activated`, `account.activated_kyc_pending`, `account.instantly_activated`, `account.instant_activation_gmv_limit_warning`, `account.payments_enabled`, `account.rejected`, `account.suspended`, `account.funds_hold`, `account.funds_unhold`, `account.updated`, `account.app.authorization_revoked` (OAuth), `product.payment_gateway.*`, `product.payment_links.*` |
| RazorpayX Payouts | `payout.pending`, `payout.rejected`, `payout.queued`, `payout.initiated`, `payout.processed`, `payout.updated`, `payout.reversed`, `payout.failed`, `payout.downtime.started`, `payout.downtime.resolved` |
| Fund account validation | `fund_account.validation.completed`, `fund_account.validation.failed` |
| Payout Links | `payout_link.pending`, `.issued`, `.processing`, `.processed`, `.attempted`, `.cancelled`, `.rejected`, `.expired` |
| Transactions (X) | `transaction.created` |

---

## 8. Errors, Rate Limits, Idempotency, Pagination

### 8.1 Error format

```json
{
  "error": {
    "code": "BAD_REQUEST_ERROR",
    "description": "Authentication failed due to incorrect otp",
    "field": null,
    "source": "customer",
    "step": "payment_authentication",
    "reason": "invalid_otp",
    "metadata": { "payment_id": "pay_EDNBKIP31Y4jl8", "order_id": "order_DBJKIP31Y4jl8" }
  }
}
```

| `code` | Typical HTTP | Meaning |
|---|---|---|
| `BAD_REQUEST_ERROR` | 400 / 401 | Invalid request, auth, validation, or customer-side failure |
| `GATEWAY_ERROR` | 502 (unverified) | Bank/gateway failure |
| `SERVER_ERROR` | 500 | Razorpay internal error |
| Throttling | 429 | Rate limited (retry with backoff + jitter) |

| `source` | Who acts |
|---|---|
| `customer` | Show message, prompt retry (wrong OTP, cancelled, insufficient funds) |
| `business` | Fix your request (missing field, wrong amount, method not enabled) |
| `gateway` / `issuer_bank` / `customer_psp` / `network` / `beneficiary_bank` | Usually transient; retry or try another method |
| `razorpay` / `internal` | Retry later; contact support |

`step` values: **cards**: `payment_initiation`, `card_enrollment_check`, `payment_authentication`, `payment_authorization`, `payment_capture`. **UPI**: `mandate_creation`, `payment_initiation`, `payment_creation`, `payment_authentication`, `payment_request`, `payment_request_beneficiary_details`, `payment_response_beneficiary_details`, `payment_debit_request`, `payment_debit_response`, `payment_credit_request`, `payment_credit_response`, `payment_status_request`, `payment_status_response`, `payment_response`, `refund_request`. Netbanking, wallet, cardless EMI and eMandate have their own step lists.

**`reason` catalogue** (from `errors/payments/list.md`):

- *Bad request*: `amount_less_than_minimum_amount`, `authentication_failed`, `bank_account_invalid`, `bank_account_validation_failed`, `bank_not_enabled`, `bank_technical_error`, `capture_failed`, `card_expired`, `card_network_not_enabled`, `card_not_enrolled`, `card_number_invalid`, `card_type_invalid`, `compliance_violation`, `debit_instrument_blocked`, `duplicate_refund_id`, `duplicate_request`, `emi_greater_than_max_amount`, `emi_plan_unavailable`, `incorrect_atm_pin`, `incorrect_card_details`, `incorrect_card_expiry_date`, `incorrect_cardholder_name`, `incorrect_cvv`, `incorrect_otp`, `incorrect_pin`, `input_validation_failed`, `insufficient_funds`, `international_transaction_not_allowed`, `invalid_amount`, `invalid_currency`, `invalid_device`, `invalid_email`, `invalid_mobile_number`, `invalid_order_id`, `invalid_request`, `invalid_user_details`, `invalid_vpa`, `live_mode_not_enabled`, `merchant_not_activated`, `mismatch_in_transaction_details`, `mobile_number_invalid`, `order_already_paid`, `order_payment_method_mismatch`, `order_amount_mismatch`, `otp_attempts_exceeded`, `otp_expired`, `payment_cancelled`, `payment_failed`, `payment_method_not_enabled`, `payment_pending_approval`, `payment_risk_check_failed`, `payment_timed_out`, `pin_attempts_exceeded`, `pin_not_set`, `record_not_found`, `recurring_payment_not_enabled`, `refund_limit_crossed`, `server_error`, `transaction_daily_limit_exceeded`, `transaction_limit_exceeded`, `transaction_frequency_limit_exceeded`, `transaction_on_vpa_restricted`, `upi_app_technical_error`, `upi_autopay_not_supported_on_psp`, `upi_collect_not_enabled`, `upi_intent_not_enabled`, `user_not_eligible`, `user_not_registered_for_netbanking`, `verification_failed`.
- *Gateway*: `authorisation_declined_by_psp`, `bank_cutoff_in_progress`, `bank_not_available`, `beneficiary_account_does_not_exist`, `beneficiary_account_dormant`, `card_declined`, `collect_on_mcc_blocked`, `collect_request_pending`, `credit_limit_exceeded`/`expired`/`inactive`/`not_approved`, `credit_not_permitted`, `credit_failed`, `debit_declined`, `deemed_transaction`, `debit_instrument_inactive`, `duplicate_rrn_found`, `funds_blocked_by_mandate`, `gateway_technical_error`, `invalid_response_from_gateway`, `issuer_technical_error`, `mandate_creation_declined`/`expired`/`failed`/`timeout`, `mcc_amount_limit_exceeded`, `payment_amount_tampered`, `payment_collect_request_expired`, `payment_declined`, `payment_declined_due_to_high_traffic`, `payment_pending`, `payment_session_expired`, `psp_app_not_available`, `psp_app_not_supported`, `psp_not_available`, `psp_not_registered`, `reqauth_mandate_not_acknowledged`, `request_timed_out`, `transaction_daily_count_exceeded`, `vpa_resolution_failed`.

**Common API errors** (`source/step/reason = "NA"`): "The requested URL was not found on the server" (wrong method or feature not enabled), "Access Denied" (IP whitelist), "The api key provided is invalid" (wrong key, wrong mode, or regenerated key), "The id provided does not exist or access is unauthorised" (wrong ID, other account, or mode mismatch), "A required parameter is missing".

### 8.2 Rate limits

- Razorpay does **not publish numeric rate limits** in the fetched docs. Exceeding the limit returns **HTTP 429** ("Throttling Error"). Retry with exponential or stepped backoff plus randomisation (jitter) to avoid a thundering herd. Limits are per account/endpoint and can be raised via support (unverified).

### 8.3 Idempotency

| API | Header | Rules |
|---|---|---|
| Refunds (normal and instant) | `X-Refund-Idempotency` | Key ≥10 chars, `[A-Za-z0-9_-]`. Retries must use the same key **and same body**; a different body gives `BAD_REQUEST`. Errors: key in use (still processing), different params with same key, invalid chars, too short, missing auth. |
| Route direct transfers | `X-Transfer-Idempotency` | Same semantics |
| RazorpayX payouts | `X-Payout-Idempotency` | **Mandatory since 15 Mar 2025**. Never retry a `processing` payout with a fresh key. |
| Orders | `receipt` (unique) is a natural dedup key; no idempotency header (unverified) | — |
| Webhooks (receiver side) | `x-razorpay-event-id` | Dedup on the consumer |

### 8.4 Pagination and filtering

| Param | Default | Notes |
|---|---|---|
| `count` | 10 | **Max 100** |
| `skip` | 0 | Offset |
| `from` | — | Unix seconds, created_at ≥ |
| `to` | — | Unix seconds, created_at ≤ |

Offset-based pagination with no cursor. Responses: `{entity:"collection", count, items[]}`. Resource-specific filters exist, for example orders `receipt`/`authorized`, payment links `reference_id`/`payment_id`, QR `customer_id`/`payment_id`, invoices `subscription_id`/`type`/`customer_id`, transfers `recipient_settlement_id`.

---

## 9. Refunds, Settlements, Disputes

### 9.1 Refunds

| Type | How | Time | Fee |
|---|---|---|---|
| **Normal** | `speed: normal` (default) | 5-7 working days typical (docs also say 7-10 business days). Cards 5-10 d, netbanking 2-10 d, wallet 0-3 d, UPI 2-7 d. | No refund fee; **original MDR/GST not returned** |
| **Instant / Optimum** | `speed: optimum` (on by default for accounts). Falls back to normal if instant isn't possible. | ≤₹5 lakh: immediate. ₹5 lakh-₹1 crore: NEFT in 3-4 h in business hours (up to 1 business day otherwise). >₹1 crore: normal speed. | ₹7.99 (≤₹1,000), ₹11.99 (₹1,000-25,000), ₹14.99 (>₹25,000) per refund (+GST). Platform fee not refunded. |
| **Batch** | XLSX/CSV upload | Picked up after **70 min** (cancellable in that window) | — |

Rules:
- Refunds only on `captured` payments.
- Multiple partial refunds allowed while their sum ≤ captured amount. The payment goes to `refunded` only when fully refunded.
- Normal refunds fail on payments **older than 6 months**.
- Instant refunds are not supported on EMI, Cardless EMI or Pay Later.
- Refunds go back to the original instrument.
- Refunds are debited from the merchant's balance. If the balance is low, add funds (Balances).
- Statuses: `pending` → `processed` | `failed`. Events: `refund.created`, `refund.processed`, `refund.failed`, `refund.speed_changed`.
- The customer tracks the refund using the ARN/RRN/UTR in `acquirer_data`.

### 9.2 Settlements

| Item | Detail |
|---|---|
| Prerequisites | KYC approved, account fully activated, payment **captured** |
| Domestic cycle | **T+2 working days** (T = capture date; bank holidays excluded). Varies by vertical/risk. |
| International cycle | Per applicable law (docs example T+7). Always settled in **INR** at the rate at payment creation. |
| Net amount | Payments − refunds − fees − tax ± adjustments − transfers (Route) − dispute deductions |
| Partial settlements | If live balance < scheduled amount (for example, refunds drew down the balance), Razorpay settles what fits and moves the rest to the next cycle |
| States | `created` → `processed` / `failed` (failure reasons: bank account inactive/frozen, wrong details, bank rejection) |
| Channel segregation | Separate balances and settlements for Online, In-Person (POS) and APM (International) |
| Holds | Settlements can be put on hold (risk / KYC). `account.funds_hold`. Dashboard lets you enable held settlements. |
| Recon | `GET /v1/settlements/recon/combined` and Settlement Recon report |
| Direct Settlement | Some merchants settle directly from the bank/acquirer (always auto-capture) |

**Instant Settlements** (on-demand feature):

| | Instant Settlement | Smart Settlement |
|---|---|---|
| Min / max per settlement | ₹100 / ₹5 Cr | ₹5 lakh / ₹50 Cr |
| Timing | 24×7 | 02:00-21:30 |
| Holidays | None | 26 Jan, 15 Aug, 1 Apr |
| Channel | IMPS (₹5 lakh per credit, so multiple credits) | RTGS (single credit) |
| API | Yes (`/v1/settlements/ondemand`) | Dashboard only |
| TAT | Instant | 0-60 min |

There is a **maximum daily withdrawable limit** that resets each business day. Fee is charged per settlement (amount not published on the pricing page).

### 9.3 Disputes and chargebacks

| Phase | Meaning |
|---|---|
| `fraud` | Bank suspects fraud (risk) |
| `retrieval` | Customer asks issuer for info ("soft" chargeback) |
| `chargeback` | Formal refund claim through issuer |
| `pre_arbitration` | Won chargeback re-challenged (2nd time) |
| `arbitration` | Third challenge; card network decides |

| Status | Meaning |
|---|---|
| `open` | Created. You must respond by `respond_by`. |
| `under_review` | Evidence submitted, bank reviewing |
| `won` | Evidence accepted |
| `lost` | Evidence rejected **or merchant accepted**; `amount_deducted` debited from balance |
| `closed` | Fraud case closed after details given or refund made |

Flow:
1. Dispute created (issuer or customer). Merchant gets an email and the `payment.dispute.created` webhook.
2. Merchant either **accepts** (refund to customer; status `lost`) or **contests**: upload documents with `POST /v1/documents`, then `PATCH /v1/disputes/:id/contest` (`action: draft|submit`).
3. On submit: `under_review`. If the evidence is insufficient: `payment.dispute.action_required`.
4. Bank verdict: `won` or `lost` (amount debited). There may be follow-on pre-arbitration or arbitration.
5. For international disputes, the INR deduction uses the conversion rate on the dispute creation day.

---

## 10. Pricing, SDKs, Plugins

### 10.1 Pricing (razorpay.com/pricing, fetched 2026-10-23; +18% GST on fees)

| Item | Standard plan |
|---|---|
| Setup fee / AMC / refund processing / integration | ₹0 |
| Domestic: cards (Visa/MC/Amex/Diners), netbanking (72+ banks), wallets, Pay Later, EMI, Cardless EMI | **2%** per successful txn |
| UPI / RuPay debit | Page shows 2% platform fee but also calls these "zero MDR". Verify per merchant category (unverified). |
| RuPay credit card on UPI | 2% |
| Corporate / business credit cards | 2.15% |
| International cards | Up to **3%** |
| Multi-currency accounts (SWIFT/ACH/SEPA/FPS inbound) | 1%, 0% FX markup |
| Smart Collect | 1% or ₹10 per txn, whichever is lower |
| UPI QR | 0.99% |
| Bharat QR (cards) | 2% |
| Payment Pages / Buttons (no-code) | 0.2% + PG fee |
| Payment Links | No extra cost (PG fee only) |
| Route | 0.1% + platform fee |
| Subscriptions (cards) | 0.9% + platform fee; UPI/NACH/eMandate on request |
| Instant Refunds | ₹7.99 / ₹11.99 / ₹14.99 (tiers ≤₹1k / ₹1k-25k / >₹25k) |
| Instant Settlements, Magic Checkout, Optimizer, TokenHQ | Custom / contact sales |
| Enterprise (> ₹5 lakh/month) | Custom pricing |
| Bajaj Finserv EMI platform charges | 3 m 6%, 4 m 7%, 6 m 8%, 9 m 11%, 12 m 13.5% |
| POS MDR | Credit 1.10-1.75% by segment; intl/corp/Amex/Diners 3%; debit 0.40% (<₹2k) / 0.90% (>₹2k); UPI and RuPay debit 0% |
| RazorpayX plans (quarterly) | BB+ Core ₹2,476; Pro ₹14,866; Pro+API ₹24,778; Vendor Payments ₹34,688 |
| Payroll | Prime ₹2,499/mo (≤20 employees), Elite ₹5,499/mo (≤50) |

Fee bearer model: **merchant-bearer** (default) or **customer fee bearer (CFB)**, where the convenience fee is added for the customer; use `/v1/payments/calculate/fees`. Dynamic convenience fees can be passed in the Orders API.

### 10.2 SDKs

| Layer | SDK / package |
|---|---|
| Web | `checkout.js` (Standard), `razorpay.js` (Custom) |
| Android | `com.razorpay:checkout:1.6.x` (Standard), `com.razorpay:customui:3.9.x` (Custom), plus `otp-assist`, `gpay`, `affordability-widget`, Turbo UPI |
| iOS | `razorpay-pod` (Standard) (unverified name), `razorpay-customui-pod`, `razorpay-turbo-pod` |
| Flutter | `razorpay_flutter` (1.4.x) |
| React Native | `react-native-razorpay`, `react-native-customui` |
| Hybrid | Cordova, Capacitor, Ionic (unverified) |
| Server | **Node** (`npm i razorpay`), **Python** (`pip install razorpay`), **PHP** (`composer require razorpay/razorpay`), **Java** (`com.razorpay:razorpay-java`), **Ruby** (`gem 'razorpay'`), **.NET** (`Install-Package Razorpay`), **Go** (`github.com/razorpay/razorpay-go`) |
| Tools | Postman public workspace, Razorpay CLI, MCP server, n8n node, App Store integrations (Zapier, Slack, Integromat) |

### 10.3 E-commerce plugins

WooCommerce, WordPress, Shopify (Razorpay Secure, COD/Magic), Magento, OpenCart, PrestaShop, BigCommerce, Wix, WHMCS, CS-Cart, Drupal Commerce, Easy Digital Downloads, Gravity Forms, Arastta, Zoho, plus a "Build your own" plugin guide.

---

## 11. Security and Compliance

| Area | Detail |
|---|---|
| Certifications | **PCI-DSS Level 1**, **ISO 27001:2022**, **SOC 2 Type 2** |
| Licence | RBI **Payment Aggregator** (PA) and **PA-CB** (cross-border) |
| Transport | HTTPS only, TLS 1.2+, EV SSL. AES-128 for user data; field-level encryption for PII. |
| API auth | Basic auth with key pair; optional IP whitelisting ("Access Denied" if not whitelisted); OAuth for partners |
| Webhook auth | HMAC-SHA256 signature (`X-Razorpay-Signature`), IP whitelist of webhook sources |
| Payment integrity | Server-side order creation (amount tamper-proofing) plus HMAC signature verification of `order_id|payment_id` with `key_secret`; `payment_amount_tampered` error |
| Card storage / tokenisation | Per **RBI card-on-file (CoF) guidelines** (from Oct 2022) merchants and PAs cannot store card numbers. Razorpay stores **network tokens** only (Visa/MC/RuPay/Amex/Diners). The customer must explicitly consent ("Save this card as per RBI guidelines"). Tokens are domain/merchant-bound. CVV-less payments for tokenised cards. TokenHQ offers Razorpay-requestor and merchant-requestor models, dual tokens, push provisioning and alt-ID guest checkout. Enabling takes about 5-7 working days. |
| 3DS / AFA | RBI Additional Factor of Authentication is mandatory for domestic cards: 3DS 2.0, native OTP, OTP assist. Recurring cards follow RBI e-mandate rules (pre-debit notification; AFA-free up to a cap) (unverified cap). |
| Dashboard 2FA | 2-step verification (OTP) for login, key regeneration and sensitive changes; enforce at team level; role-based access; audit trail (Pseudo Owner logging) |
| Fraud and risk | Hotlisted card checks, geo- and pattern-based monitoring, fraudulent chargeback flagging, risk decline rate and fraud/dispute-sales ratio dashboards for international payments, AVS for international cards, TPV (third-party validation of payer bank account) for regulated sectors |
| UPI compliance | NPCI UPI Collect deprecation (28 Feb 2026); SEBI `@valid<bank>` handles for MCC 6211 |
| KYC compliance | CKYC / Master KYC 2026, VKYC, Re-KYC, penny-drop bank verification |
| Disclosure | HackerOne bug bounty |

---

## 12. Design Takeaways for opengateway

Mapping Razorpay patterns into opengateway:

1. **Order-first model**: amount is locked server-side in `orders`; payments attach to orders; at most one captured payment per order (unless partial payments are on). Order states: `created → attempted → paid`.
2. **Two-phase payments**: `created → authorized → captured`, with configurable auto-capture window (default 3 days, min 12 min) and auto-refund of uncaptured payments. Model **late authorisation** with a poller (up to 3 days).
3. **Signature contract**: checkout returns `{payment_id, order_id, signature}` where `signature = HMAC_SHA256(key_secret, order_id|payment_id)`. Webhooks are signed with a separate per-endpoint secret over the raw body.
4. **ID format**: prefix + 14-char base62 (`pay_`, `order_`, `rfnd_`...). Every object carries `entity`. Lists use `{entity:"collection", count, items}`. Pagination is `count/skip/from/to` with max 100.
5. **Error envelope**: `{error:{code, description, field, source, step, reason, metadata}}`. Use `source` and `step` taxonomies and a stable `reason` enum so merchants can branch programmatically.
6. **Webhooks**: up to N endpoints, per-event subscription, 5s timeout, exponential retries for 24h, then auto-disable with email alert, `x-<gw>-event-id` header for dedup, at-least-once delivery, unordered, snapshot payloads, delivery logs UI, manual replay.
7. **Idempotency headers** on money-moving POSTs (refunds, transfers, payouts), with same-key-same-body enforcement and clear error codes.
8. **Refund speeds** (`normal`/`optimum`) with `speed_requested` vs `speed_processed`, plus batch refunds with a cancellable delay.
9. **Settlement engine**: T+N per merchant, holiday calendar, partial settlements when balance is short, segregated balances per channel, on-demand instant settlement with daily limit and fee, a recon endpoint, and UTR on each settlement.
10. **Disputes**: phases × statuses, evidence document upload, `draft`/`submit` contest, auto-deduct on loss.
11. **Dashboard IA** to copy: Home (balances + insights), Transactions (Payments/Refunds/Orders/Disputes/Success Rate), Settlements, Reports (download/schedule, 95-day cap, 3 concurrent), Payment Products (Links/Pages/Buttons/QR/Subscriptions/Invoices/Smart Collect/Route/Offers), Developers (API and webhook logs), Account & Settings (API keys, webhooks, branding, checkout features, payment methods, capture settings, limits, bank account, team and roles, 2FA).
12. **Test mode parity**: a separate key pair, a mock bank page with Success/Failure, magic VPAs (`success@...`/`failure@...`), test card numbers, and fully isolated data.
13. **UPI-first India reality**: build UPI Intent and QR flows (Collect is deprecated) and design an S2S `next[]` action protocol (`redirect`, `otp_submit`, `intent`, `poll`).
