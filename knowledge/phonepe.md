# PhonePe Payment Gateway (PhonePe PG / PhonePe for Business): Reference Knowledge File

> **Research date:** 2026-10-23
> **Purpose:** Reference for building **opengateway**, an open-source payment gateway inspired by Razorpay, PhonePe PG and Cashfree.
> **Method:** I read PhonePe's public developer docs, business pages, dashboard docs, SDK docs and a few community sources. Items marked **(unverified)** come from community code, from memory of older docs that now redirect, or from sources that contradict each other. Check them before relying on them.

## Sources

Primary (developer.phonepe.com, v2 / current docs):
- Authorization (OAuth token): https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/authorization
- Create Payment (Standard Checkout): https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/create-payment/initiate-payment
- Invoke iframe PayPage: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/invoke-iframe-paypage
- Order Status: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/order-status
- Refund and Refund Status: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/refund
- Webhook Handling: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/webhook
- Integration steps: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/integration-steps
- Branding: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/branding-and-customization
- Partner checklist (polling schedule, token caching, TSP headers): https://developer.phonepe.com/tsp-integration/partner-checklist/partner-checklist-standard
- Error codes: https://developer.phonepe.com/payment-gateway/error-codes
- General FAQs: https://developer.phonepe.com/payment-gateway/general-faqs
- UAT Sandbox: https://developer.phonepe.com/payment-gateway/uat-testing-go-live/uat-sandbox
- Mobile Create Order Token: https://developer.phonepe.com/payment-gateway/mobile-app-integration/standard-checkout-mobile/api-reference/create-order-token
- Android SDK setup: https://developer.phonepe.com/payment-gateway/mobile-app-integration/standard-checkout-mobile/android-sdk/sdk-setup
- React Native SDK setup: https://developer.phonepe.com/payment-gateway/mobile-app-integration/standard-checkout-mobile/react-native/sdk-setup
- Flutter SDK setup: https://developer.phonepe.com/payment-gateway/mobile-app-integration/standard-checkout-mobile/flutter/sdk-setup
- Custom Checkout UPI Intent: https://developer.phonepe.com/payment-gateway-custom-checkout/custom-api-integration/initiate-payment/upi-intent
- Custom Checkout UPI Collect: https://developer.phonepe.com/payment-gateway-custom-checkout/custom-api-integration/initiate-payment/upi-collect-api/upi-collect
- Custom Checkout Card: https://developer.phonepe.com/payment-gateway-custom-checkout/custom-api-integration/initiate-payment/card
- Payment Links API: https://developer.phonepe.com/payment-gateway/payment-links/api-reference-payment-links/introduction
- Payment Links via dashboard: https://developer.phonepe.com/payment-gateway/payment-links/dashboard/create-payment-link
- Autopay intro: https://developer.phonepe.com/payment-gateway/autopay/api-integration/introduction
- Autopay subscription setup: https://developer.phonepe.com/payment-gateway/autopay/api-integration/api-reference/subscription-setup
- Autopay webhooks: https://developer.phonepe.com/payment-gateway/autopay/standard-checkout/webhook-handling
- Autopay notify redemption: https://developer.phonepe.com/payment-gateway/autopay/api-integration/api-reference/redemption-notify
- Chargeback / Dispute APIs: https://developer.phonepe.com/chargeback
- Chargeback webhooks: https://developer.phonepe.com/chargeback/webhook-handling
- Node SDK webhook handling: https://developer.phonepe.com/payment-gateway/backend-sdk/nodejs-be-sdk/api-reference-node-js/webhook-handling
- WooCommerce plugin: https://developer.phonepe.com/payment-gateway/e-commerce-plugins/woocommerce
- Dynamic QR (offline): https://developer.phonepe.com/v2/reference/qr-init-2

Business dashboard docs:
- Register and Login: https://developer.phonepe.com/docs/business-dashboard/register-and-login
- Home: https://developer.phonepe.com/docs/business-dashboard/home
- Transaction: https://developer.phonepe.com/docs/business-dashboard/transaction
- Reports: https://developer.phonepe.com/docs/business-dashboard/reports
- Settlements: https://developer.phonepe.com/docs/business-dashboard/settlements
- Manage Users: https://developer.phonepe.com/docs/business-dashboard/manage-users
- Profile: https://developer.phonepe.com/docs/business-dashboard/profile
- Help: https://developer.phonepe.com/docs/business-dashboard/help
- Settlements (report format): https://developer.phonepe.com/docs/settlements
- Refund TAT: https://developer.phonepe.com/docs/refunds-tat

Business / marketing / help:
- https://business.phonepe.com/standard-checkout
- https://business.phonepe.com/articles/how-to-get-payment-gateway-registration-in-india-complete-process
- https://business.phonepe.com/articles/payment-gateway-charges-in-india-complete-mdr-and-fee-breakdown
- https://www.phonepe.com/apollo/pdf/Merchant_Profiling_Guidelines.pdf
- https://cms.phonepe.com/en/mx/merchant-help/settlements/know-more-about-settlements/how-do-i-view-or-download-my-settlement-report
- https://apps.shopify.com/phonepe-payment-gateway
- https://wordpress.org/plugins/phonepe-payment-solutions/

Legacy v1 (most v1 pages now redirect to v2 or return 404; v1 details below come from search snippets and community code):
- https://developer.phonepe.com/v1/reference/pay-api-1 (redirects)
- https://developer.phonepe.com/v1/reference/check-status-api-1 (redirects)
- https://developer.phonepe.com/v1/docs/pg-custom-checklist
- https://dev.to/aritra_dutta_07526ad4f6bb/phonepe-payment-gateway-integration-a-complete-guide-49l8
- https://app.unpkg.com/quickpos@1.0.924/files/lib/phonepe.js (community implementation)
- https://jentic.com/apis/phonepe.com/phonepe.md

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Onboarding, KYC, Environments and Credentials](#2-onboarding-kyc-environments-and-credentials)
3. [PhonePe Business Dashboard (web + app)](#3-phonepe-business-dashboard-web--app)
4. [Checkout UX](#4-checkout-ux)
5. [Integration Flow v2 (OAuth, current)](#5-integration-flow-v2-oauth-current)
6. [Integration Flow v1 (legacy X-VERIFY checksum)](#6-integration-flow-v1-legacy-x-verify-checksum)
7. [Custom Checkout (S2S instrument APIs)](#7-custom-checkout-s2s-instrument-apis)
8. [Mobile SDKs](#8-mobile-sdks)
9. [Webhooks](#9-webhooks)
10. [Payment Links](#10-payment-links)
11. [Autopay / Subscriptions (UPI mandates)](#11-autopay--subscriptions-upi-mandates)
12. [Offline: QR, SmartSpeaker, POS/EDC](#12-offline-qr-smartspeaker-posedc)
13. [Error Codes, Rate Limits, Idempotency, Reconciliation](#13-error-codes-rate-limits-idempotency-reconciliation)
14. [Refunds, Settlements, Disputes/Chargebacks](#14-refunds-settlements-disputeschargebacks)
15. [Pricing](#15-pricing)
16. [Backend SDKs and Plugins](#16-backend-sdks-and-plugins)
17. [Security and Compliance](#17-security-and-compliance)
18. [Design Takeaways for opengateway](#18-design-takeaways-for-opengateway)
19. [Gaps and Unverified Items](#19-gaps-and-unverified-items)

---

## 1. Product Overview

PhonePe for Business offers online (PG) and offline (in-store) acceptance. The PG ("PhonePe Payment Gateway") is RBI-licensed as a payment aggregator through PhonePe Pvt Ltd. It accepts INR only and transactions within India only, although the marketing page also mentions "international cards / cross-border processing".

### 1.1 Product catalogue

| Product | What it is | Integration style |
|---|---|---|
| **Standard Checkout (Web)** | PhonePe-hosted PayPage that handles instrument selection, 3DS and OTP. Opened as an iframe (recommended) or by full redirect. | `POST /checkout/v2/pay` returns `redirectUrl`, which the frontend opens with `checkout.js` `PhonePeCheckout.transact()` |
| **Standard Checkout (Mobile)** | Same PayPage launched via native SDKs | `POST /checkout/v2/sdk/order` returns `token`, which the app passes to the SDK (`startCheckoutPage` / `startTransaction`) |
| **Custom Checkout** | Merchant builds its own UI. S2S APIs per instrument: UPI_INTENT, UPI_COLLECT, UPI_QR, CARD, TOKEN (saved card), NET_BANKING | `POST /payments/v2/pay` with `paymentFlow.type = "PG"` and `paymentMode` |
| **UPI Intent** | Returns `intentUrl` (`upi://...` or `ppe://...`). The app or mobile web opens the UPI app directly. | Custom checkout |
| **UPI Collect** | Collect request sent to a VPA or UPI number | Custom checkout |
| **UPI QR** | Returns a QR string or intent for display | Custom checkout |
| **Payment Links** | Fixed-amount shareable links (SMS, email, WhatsApp). One successful payment per link. | Dashboard or `/paylinks/v1/*` API |
| **Autopay / Subscriptions** | UPI AutoPay mandates (recurring and on-demand), pre-debit notify, redeem | `/subscriptions/v2/*`, or `/checkout/v2/pay` with `SUBSCRIPTION_CHECKOUT_SETUP`, or paylinks with `SUBSCRIPTION_PAYLINK_SETUP` |
| **One-time mandate / eNACH** | Separate doc sections exist (`/payment-gateway/one-time-mandate`, `/payment-gateway/enach`) | Not researched in depth |
| **PG Bolt** | "Zero-redirect, app-locked checkout" (marketing name) | (unverified details) |
| **EMI, Pay on Delivery, Offers** | Listed on the marketing page | (unverified API details) |
| **Offline: Static QR, Dynamic QR, SmartSpeaker, POS/EDC** | In-store acceptance. Separate "In-store Payments" (offline-integration) docs using v3 X-VERIFY APIs. | `/v3/qr/init`, EDC Sale Request, etc. |
| **Switch** | Separate product section on the dev portal (`/switch`), a super-app/mini-app platform | Out of scope |
| **PhonePe Business app** | Android/iOS merchant app (`com.phonepe.app.business`) for QR acceptance, history, settlements, loans, SmartSpeaker | n/a |
| **Plugins** | WooCommerce ("PhonePe Payment Solutions"), Shopify app, Magento | Plugin config uses Client ID, Client Secret ("API Key") and Client Version |

### 1.2 Payment instruments on Standard Checkout

From business.phonepe.com/standard-checkout:
- **UPI:** one-tap via PhonePe, Google Pay, Paytm and other BHIM UPI apps. Supports intent, collect and QR.
- **Cards:** Visa, Mastercard, Maestro, RuPay, Amex (credit and debit). RBI-compliant tokenised saved cards, so returning customers enter only the CVV.
- **Net banking:** "direct pipelines to 50+ banks"
- **PhonePe Wallet** (PPI). Split payments are possible, for example wallet plus UPI.
- **EMI**, **Credit line** (`CREDIT_LINE` instrument appears in status samples), **International cards**
- Features claimed: real-time switching between bank gateways, intelligent retries (suggests a different UPI app or card after a failure), customizable branding, and 24/7 support.

### 1.3 `paymentMode` values seen in responses

`UPI_INTENT`, `UPI_COLLECT`, `UPI_QR`, `CARD`, `NET_BANKING`, `TOKEN`, `PPE_INTENT` (PhonePe app intent with wallet split), `CREDIT_LINE`, and `PAY_PAGE` (SDK request).

`rail.type`: `UPI`, `PG`, `PPI_WALLET` / `WALLET`.
`instrument.type`: `ACCOUNT`, `CREDIT_CARD`, `DEBIT_CARD`, `NET_BANKING`, `WALLET`, `CREDIT_LINE`.

---

## 2. Onboarding, KYC, Environments and Credentials

### 2.1 Registration flow (dashboard)

From `/docs/business-dashboard/register-and-login`:
1. Choose where you accept payments: **"On Website/App/Social Media"** or **"In Store/Shop"**.
2. Choose a product: **Payment Gateway** or **Payment Links**.
3. Enter business **Email ID** and **Phone Number** (the phone is verified).
4. Click **PROCEED** and accept the T&C.
5. Sign-up URL: `https://business.phonepe.com/pg/register`

**Login options:** phone number with OTP, or business email with password. Invited users get a "PhonePe dashboard access –" email or an SMS link.

### 2.2 KYC documents (by entity type)

PhonePe says KYC is mandatory. It first tries to pull KYM data from **CKYCR** (Central KYC Records Registry). Uploads are usually PDF or JPG under 5 MB each.

| Entity | Documents |
|---|---|
| Individual / Freelancer | PAN; address proof (Aadhaar, passport, voter ID or DL); cancelled cheque or passbook (name, account number, IFSC); photo; description of products or services; website or social proof (optional) |
| Sole proprietorship | Proprietor PAN; address proof; one business proof (GST, utility bill under 3 months, rent agreement, Udyam, Shop and Establishment, or professional tax); bank proof in business or proprietor name; trade licence if applicable |
| Partnership | Firm PAN; partnership deed; address proof; PAN and Aadhaar of signatories; cancelled cheque in firm name; GST and S&E if applicable; UBO declaration (10–25% holders) |
| LLP | Certificate of Incorporation; LLP agreement; LLP PAN; PAN and address of designated partners; cheque or statement in LLP name |
| Pvt/Public Ltd | CoI; MoA and AoA; company PAN; directors' PAN and address; current account statement or cheque; board resolution; GST if applicable; website with T&C and Privacy Policy |
| Trust / Society | Not covered in the sources I found (unverified) |

Verification checks include KYC authenticity, PAN, GST (if applicable), negative database screening, bank account verification (penny drop, likely), background checks, website legitimacy and RBI PA guideline compliance. The bank account must be in the proprietor's or firm's name for sole proprietorships, or in the legal entity's name for other entity types. GST is not mandatory below the turnover threshold.

**Website requirements** (industry-standard, partly unverified for PhonePe): T&C, Privacy Policy, Refund/Cancellation policy, Contact Us, and product pricing. The redirect URLs and domains or app package names that you use **must match the ones shared during onboarding**. Otherwise PhonePe raises `INTERNAL_SECURITY_BLOCK_1` / "Internal Security Block" (FRA).

**Timelines:** KYC and go-live usually take 2–5 business days (FAQ), or 1–3 business days when documents are complete. Technical integration takes a few hours to a couple of days.

### 2.3 Environments and base URLs

| Environment | Auth (token) host | All other PG APIs |
|---|---|---|
| **Sandbox / UAT (v2)** | `https://api-preprod.phonepe.com/apis/pg-sandbox` | `https://api-preprod.phonepe.com/apis/pg-sandbox` |
| **Production (v2)** | `https://api.phonepe.com/apis/identity-manager` | `https://api.phonepe.com/apis/pg` |
| **Sandbox / UAT (v1)** | n/a (checksum) | `https://api-preprod.phonepe.com/apis/pg-sandbox` (some pages say `/apis/pgsandbox`) |
| **Production (v1)** | n/a | `https://api.phonepe.com/apis/hermes` |
| Checkout JS bundle (prod) | | `https://mercury.phonepe.com/web/bundle/checkout.js` |
| Checkout JS bundle (staging) | | `https://mercury-stg.phonepe.com/web/bundle/checkout.js` |
| v1 UAT PayPage simulator (unverified) | | `https://mercury-uat.phonepe.com/transact/simulator?token=...` |

### 2.4 Credentials

| API generation | Credentials | Where |
|---|---|---|
| **v2 (current)** | `client_id`, `client_secret`, `client_version` (an integer, for example `1`). Also a Merchant ID (MID) for SDK init and partner headers. | Dashboard → **Developer Settings → API Keys** (prod). UAT keys come from the PhonePe Integration Team. |
| **v1 (legacy)** | `merchantId` (MID), **Salt Key** (UUID-like), **Salt Index** (int, usually `1`) | Dashboard or integration team |
| **Webhooks** | Username plus password (SHA mode) **or** HMAC secret key plus webhook ID | Dashboard → Developer Settings → Webhook |
| **Custom card flow** | `encryptionKey` (RSA-4096 public key) plus `encryptionKeyId`, issued per MID | Integration team |

Community UAT sample credentials for v1 (widely copy-pasted, **sandbox only, unverified**): MID `PGTESTPAYUAT`, salt index `1`, plus a published salt key. Never use them in production.

A GitHub issue reports that after switching the dashboard to production, the developer saw only an "API Key" and not client_id, client_secret or client_version. The dashboard UI and naming may vary.

### 2.5 UAT sandbox testing

- The sandbox uses **templates** that map APIs to canned Success, Failure or Pending responses. The default template is Success.
- **PhonePe Test App** (Android package `com.phonepe.simulator`; iOS through a Firebase invite after you share your email with the integration team). Open it, tap **Test Case Templates**, enter your MID, tap **Get Configured Templates**, pick the flow ("Custom and Standard Checkout V2") and pick a scenario: `Paypage Upi Intent Success`, `Paypage Upi Intent Failure` or `Paypage Upi Intent Pending`.
- If you don't configure a template before calling pay, you may get **HTTP 500**.
- **UPI QR:** scan the UAT QR with any **production** UPI app, then choose Success, Failure or Pending on the linked page.
- **Card and net banking:** you are redirected to a simulator page where you pick Success, Failure or Pending.
- **Test VPAs:** `success@ybl`, `failed@ybl`, `pending@ybl`. Any other VPA counts as invalid.
- **Test cards:**

| Type | Number | Expiry | CVV |
|---|---|---|---|
| Credit (VISA) | 4208 5851 9011 6667 | 06/2027 | 508 |
| Debit (VISA) | 4242 4242 4242 4242 | 12/2027 (page garbled) | 936 |

- **Simulated bank OTP:** `123456`

### 2.6 Go-live

1. Finish the integration and share the UAT URL or app with the PhonePe Integration Team for a sanity check.
2. Pass all mandatory use cases to get **UAT sign-off**. Production credentials are then shared or enabled on the dashboard.
3. Swap the client ID and secret, and switch hosts to `identity-manager` (auth) and `/apis/pg` (other APIs).
4. SDK: `PhonePeEnvironment.RELEASE` / `PRODUCTION`, with `enableLogging = false`.
5. Register your production domains and app package names with PhonePe so the referrer check passes.
6. The dashboard has a **Test Mode toggle** (ON = sandbox, OFF = production), which affects webhook config and probably the keys view.

---

## 3. PhonePe Business Dashboard (web + app)

Web: `business.phonepe.com` (dashboard). The left navigation (per the dashboard docs) is **Home, Transaction, Reports, Settlements, Manage Users, Profile, Help**. Payment Links, Developer Settings (API Keys, Webhook) and Settings (Brand Colour) also exist as separate menus. There is a **Test Mode toggle**, and a **Merchant ID selector** when one login maps to several MIDs.

### 3.1 Home

| Element | Detail |
|---|---|
| KPIs | **Total Transaction Amount**, **Average Transaction Amount**, **Number of Transactions** |
| Date filter | Past 6 months, This month, This week, Today, Custom |
| Merchant ID selector | One, several or all MIDs, for business-trend charts |
| Charts | Business trend graphs (not described in detail) |

### 3.2 Transaction

Three tabs: **Live Transactions**, **Transactions History**, **Refunds**.

**Live Transactions**
- Latest **20** transactions, near real-time, with a "Live from [time]" indicator.
- Filters: **Store** and **Terminal**.
- Buttons: **Refresh** icon, **Transaction Reports** link (top right), **View Older Transactions** (goes to History).

**Transactions History** (last **6 months**)
- Date selector: This Month, This Week, Today, Custom.
- **Filters** modal: Transaction Status (Completed, Pending, Failed, Cancelled, Select All), Mode of Payment (PhonePe, other UPI apps, debit card, ...), Store, Terminal, QR Code.
- **Search:** phone number, Txn ID or UTR, Store ID, Terminal ID.
- **Three-dot menu:** **Print Summary**, **Additional Columns** (show or hide columns).
- **Summary:** Transactions Count and Total Transactions Amount.
- **Columns:** Date, Transaction Reference, Status, Amount, Payment Mode, Store.
- **Row click → Details page.** Managers and admins can **initiate a refund** (full or partial) from here.

**Refunds tab**
- **All Refunds** sub-tab. Default range is Past 6 Months. Search by phone, Txn ID or Refund ID. Columns: Refund Date, Refund ID (with copy icon), Status, Amount, Original Transaction Id, Payment Mode. **Refund Reports** link.
  - Refund identifiers: **UTR** for account and UPI refunds, **ARN** for card refunds, none for wallet refunds.
- **Bulk Refunds** sub-tab:
  - Table: Date, Status, Refund Reason, Summary, Uploaded File (download), Report (download).
  - **+ Initiate Bulk Refund** opens a 2-step modal. Step 1: **Download Sample Form** (CSV template), upload the CSV by click or drag-and-drop, then Cancel or **Next**. Step 2 (unverified): confirm and give a reason.
  - CSV needs at least Transaction ID and Refund Amount.
  - The batch report shows total requested, successful, failed (other errors), failed (exceeded refundable amount) and total amount refunded.

### 3.3 Reports

Two sub-tabs: **Transaction Reports** and **Refund Reports**.
- **Generate Report** button opens a modal with:
  - Duration (This Month, This Week, Yesterday, Today, Custom)
  - From and To dates, plus Start and End time
  - Status (Completed, Pending, Failed)
  - Instrument (UPI, Credit Card, Wallet, ...)
  - Merchant IDs
  - Email (delivery address)
  - **Generate** and **Clear All Filters** buttons
- **Report History** table: Date, Duration, Selected Instruments, Merchants, Selected Payment Status, Report Status/Action (Pending, or Completed with a **Download** link).
- Note: "Transactions done in the last 1 hr might take some time to appear in the report."
- Reports are generated asynchronously on demand. The file format is not documented (likely CSV/XLSX, unverified).

### 3.4 Settlements

- Banner: **"Haven't received settlements? Get Help"**. The **Get Help** modal explains weekday settlement, that Fri–Sun payments settle Monday (or Tuesday if Monday is a holiday), and has a **View Bank Holidays** link, a **Need more help?** button and **Done**.
- **Last Settlement Summary:** amount and date/time of the last payout.
- **Month navigator:** arrows plus Previous Month and Next Month buttons.
- **Table columns:** Initiated At, Last Updated At, Amount, Status (for example `SUCCESS`), **UTR** (with copy icon), Mode of Settlement (for example `Auto-Settle`).
- **Row click** opens the **Settlement Details** sidebar with the breakdown (gross, fees, GST, refunds, adjustments).
- **Settlement report** (download) fields: `PaymentType` (payment or refund), `MerchantReferenceId`, `PhonePeReferenceId`, `From`, `Instrument` (`UPI_REDEMPTION`, `PG_REDEMPTION_CC`, `PG_REDEMPTION_DC`, `WALLET_REDEMPTION`, or adjustments such as `EXCESS_RECOVERY`, `INVOICE_RECOVERY`, `SHORT_SETTLEMENT`), `CreationDate`, `TransactionDate`, `Amount` (INR, 2 decimals), `Fee`, `SettlementDate`, `BankReferenceNo` (UTR), `IGST`, `CGST`, `SGST`.
  - Fees and taxes are negative values, so **settled amount = Amount + Fee + IGST + CGST + SGST**.
- In the merchant app, settlements are under **History → Settlement**. A day's report can be downloaded only from the next day. Fees are under each settlement's **Deductions** section.

### 3.5 Manage Users (Team)

| Role | Access | Refunds | Settlements | Add users |
|---|---|---|---|---|
| **Admin** (default for the registrant) | All sections | Yes | Yes | **Only role that can** |
| **Finance Manager** | Settlement and transaction pages, report downloads | Yes | Yes | No |
| **Manager** | Transactions, Profile, Mapped QR Codes, edit notification receivers | Yes | Not described | No |
| **Supervisor** | Transactions, Profile, Mapped QR Codes, edit notification receivers | No | No | No |
| **Cashier** | Transactions, Profile, view Mapped QR Codes | No | No | No |

- **Add New User** flow: name, contact number, email, role, then **Add User** and **Yes** to confirm. The user gets an email verification link and sets a password.
- **Edit role:** click the Role, change the **User Role** dropdown in the Edit User Details modal, then Save.
- **Manage Store Access:** a **Restrict store access** toggle, store search and checkboxes, then **OK**.

### 3.6 Profile

- **Header:** user name, role, Merchant Store Name (Admin can edit), **Reset Password** button.
- **User Details:** phone and email are read-only. To change them, call support at 080-6872-7777 or 022-6872-7777.
- **Payment Options:** enabled instruments, such as External Account/EGV, Wallet, Credit Card, UPI, Line of Credit. These are read-only and changed through support.
- **Business Details:** Address, Business Email, Business Phone (edit icons).
- **Bank Account Details:** Bank Name, masked Account Number, Account Holder Name, Account Type, IFSC. Read-only.

### 3.7 Developer Settings

- **API Keys:** Client ID, Client Version and Client Secret (the WooCommerce docs call the secret the "API Key").
- **Webhook** tab, then **Create Webhook**:
  - **HMAC mode:** URL, Events, Description. A secret key is generated and can be viewed later. Only URL, events and description are editable.
  - **SHA (Basic) mode:** URL, Username, Password, Description, Active Events.
- **Test Mode toggle** chooses sandbox or production config.

### 3.8 Payment Links (menu)

**New paylinks → Single payment link**, then the form, then **Generate link**. See [section 10](#10-payment-links).

### 3.9 Settings → Brand Colour (Branding)

- Brand colour (picker, RGB or hex), button text theme (Dark or Light), background image from a library, live preview, **Back to Default**, Save.
- Applies to the Standard Checkout page and Payment Links. The docs describe no logo upload; the logo probably comes from the business profile (unverified).

### 3.10 Help

- "Need Help?" category icons (Transactions, Settlements, Manage Account, ...) lead to FAQ lists, then a raise-ticket option.
- **View your tickets → Open >** shows a popup list of raised tickets with their status.
- The FAQ says to raise integration issues here with the API host and endpoint, request and response payloads, platform, and screenshots.

### 3.11 PhonePe Business mobile app

- Accept payments via QR (download the QR sticker or order free stickers), track transactions, settlements in **History**, 6-month analytics (daily, weekly, monthly), loans, SmartSpeaker management, and notification receivers.
- **SettleNow / instant settlement:** early access to funds during the day. Eligibility and fees are unverified for India.

### 3.12 Disputes (dashboard)

Dispute management exists through the API ([section 14.3](#143-disputes--chargebacks)). The dashboard UI for disputes is not documented in the sources I found (unverified).

---

## 4. Checkout UX

### 4.1 Hosted PayPage (Standard Checkout)

- The server calls `/checkout/v2/pay` and receives `redirectUrl` (for example `https://mercury-t2.phonepe.com/transact/...`).
- The frontend loads `checkout.js`, which adds `window.PhonePeCheckout` with `transact()` and `closePage()`.
- **IFRAME mode (recommended):**

```html
<script src="https://mercury.phonepe.com/web/bundle/checkout.js"></script>
<script>
  function callback(response) {
    if (response === 'USER_CANCEL') { /* user closed the PayPage */ return; }
    if (response === 'CONCLUDED')   { /* terminal state reached; verify server-side */ return; }
  }
  window.PhonePeCheckout.transact({ tokenUrl: redirectUrlFromBackend, callback, type: "IFRAME" });
  // window.PhonePeCheckout.closePage(); // manual close, IFRAME only, exceptional cases
</script>
```

- **REDIRECT mode:** `window.PhonePeCheckout.transact({ tokenUrl })`, or simply `window.location = redirectUrl`. After payment the user returns to `paymentFlow.merchantUrls.redirectUrl`.
- The JS callback values are only `USER_CANCEL` and `CONCLUDED`. They never carry success or failure. **Always** confirm through webhook or Order Status.
- **The redirect back to the merchant (v2) carries no signed payload.** The merchant must look up its own `merchantOrderId` and call Order Status.
- **Referrer rules:** opening the PayPage in a **new tab or window** loses the referrer and triggers "Internal Security Block". Do not set `Referrer-Policy: no-referrer` on the checkout page. Redirects must come from URLs or domains registered at onboarding.
- `redirectUrl` must be used **exactly** as returned, with no truncation or modification.
- `prefillUserLoginDetails.phoneNumber` pre-fills the PhonePe login.
- `paymentModeConfig` with `enabledPaymentModes` or `disabledPaymentModes` (not both) controls which instruments show. Card entries can restrict `cardTypes` to `DEBIT_CARD` and/or `CREDIT_CARD`.
- `disablePaymentRetry: true` disables retries on the PayPage after a failure.
- The PayPage handles UPI (intent on mobile web, QR and collect on desktop), cards (3DS/OTP, saved tokenised cards needing only CVV), net banking (bank list), wallet and EMI.
- Order expiry: `expireAfter` from 300 to 3600 s for Standard Checkout.

### 4.2 Mobile intent flow

- **Standard Checkout mobile:** the backend gets `token` and `orderId` from `/checkout/v2/sdk/order`. The app calls `PhonePeKt.startCheckoutPage(context, token, orderId, launcher)`. The SDK opens the PayPage or the UPI app. The activity result only signals completion, so the backend checks webhook or status.
- **Custom UPI Intent:** the backend calls `/payments/v2/pay` with `UPI_INTENT`, `deviceContext.deviceOS` and `targetApp` (an Android package name such as `com.phonepe.app`, or an iOS constant such as `PHONEPE`, `GPAY`, `PAYTM`, `CRED`, `SUPERMONEY`, `BHIM`, `AMAZON`). The response has `intentUrl`, which the app launches. On iOS the `merchantCallBackScheme` returns control to the app.

### 4.3 Redirect and callback behavior summary

| Channel | What arrives | Trust? |
|---|---|---|
| Browser redirect to `redirectUrl` (v2) | User returns. No reliable payload. | No. Call Order Status. |
| JS callback (`USER_CANCEL` / `CONCLUDED`) | UI hint | No |
| SDK result (`SUCCESS`, `FAILURE`, `INTERRUPTED`) | UI hint | No |
| Webhook (S2S) | Signed (SHA256 Basic or HMAC) JSON with `event` and `payload.state` | Yes, after verification |
| Order Status API | Authoritative `state` | Yes |
| v1 redirect (`redirectMode` REDIRECT or POST) | v1 POSTs form fields to the redirect URL (code, merchantId, transactionId, amount, providerReferenceId, checksum, unverified) | Verify checksum, then call status |
| v1 S2S callback | `{"response":"<base64>"}` with `X-VERIFY` | Yes, after checksum |

---

## 5. Integration Flow v2 (OAuth, current)

```
Merchant server                PhonePe identity-manager     PhonePe PG (/apis/pg)           Customer
  | POST /v1/oauth/token  ------->|                               |                              |
  |<------ access_token (O-Bearer), expires_at                    |                              |
  | POST /checkout/v2/pay (Authorization: O-Bearer <token>) ----->|                              |
  |<------ { orderId, state: PENDING, expireAt, redirectUrl } ----|                              |
  | send redirectUrl to browser --------------------------------------------------------------->|
  |                                                               |<---- pays on PayPage --------|
  |<------ webhook checkout.order.completed / failed (S2S) -------|                              |
  |                                                               |---- redirect to merchant --->|
  | GET /checkout/v2/order/{merchantOrderId}/status ------------->|                              |
  |<------ { state: COMPLETED|FAILED|PENDING, paymentDetails[] } -|                              |
  | POST /payments/v2/refund ------------------------------------>|                              |
  |<------ { refundId, state: PENDING }                           |                              |
  |<------ webhook pg.refund.completed / failed                   |                              |
  | GET /payments/v2/refund/{merchantRefundId}/status ----------->|                              |
```

### 5.1 Step 1: Fetch OAuth token

| | Sandbox | Production |
|---|---|---|
| URL | `POST https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token` | `POST https://api.phonepe.com/apis/identity-manager/v1/oauth/token` |

Header: `Content-Type: application/x-www-form-urlencoded`

Form fields:

| Field | Value |
|---|---|
| `client_id` | From dashboard or integration team |
| `client_version` | From dashboard (integer, for example 1) |
| `client_secret` | From dashboard |
| `grant_type` | `client_credentials` |

```bash
curl --location 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'client_id=CLIENT_ID' \
  --data-urlencode 'client_version=1' \
  --data-urlencode 'client_secret=CLIENT_SECRET' \
  --data-urlencode 'grant_type=client_credentials'
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "encrypted_access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": null,
  "issued_at": 1706073005,
  "expires_at": 1706697605,
  "session_expires_at": 1706697605,
  "token_type": "O-Bearer"
}
```

- Use it as `Authorization: O-Bearer <access_token>` (the literal scheme is `O-Bearer`).
- `issued_at` and `expires_at` are epoch **seconds**. In the sample the lifetime is about 7.2 days (624,600 s); the actual TTL may differ (unverified).
- **Token caching rules** (partner checklist): do **not** call the auth API before every request. Either check `expires_at` before each call and refresh when expired, or run a scheduler that refreshes 3–5 minutes before expiry.
- A `401` means the token is invalid or expired, or credentials and hosts are mixed between UAT and prod. Regenerate the token.

### 5.2 Step 2: Create payment (Standard Checkout)

| | Sandbox | Production |
|---|---|---|
| URL | `POST https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay` | `POST https://api.phonepe.com/apis/pg/checkout/v2/pay` |

Headers: `Content-Type: application/json`, `Authorization: O-Bearer <token>`. Partners also send `X-MERCHANT-ID: <end merchant MID>`.

Request:

```json
{
  "merchantOrderId": "TX123653456743456",
  "amount": 1000,
  "expireAfter": 1200,
  "metaInfo": {
    "udf1": "additional-information-1",
    "udf2": "additional-information-2",
    "udf3": "additional-information-3"
  },
  "paymentFlow": {
    "type": "PG_CHECKOUT",
    "message": "Payment message used for collect requests",
    "merchantUrls": {
      "redirectUrl": "https://merchant.example.com/payment/return?order=TX123653456743456"
    },
    "paymentModeConfig": {
      "enabledPaymentModes": [
        { "type": "UPI_INTENT" },
        { "type": "UPI_COLLECT" },
        { "type": "UPI_QR" },
        { "type": "NET_BANKING" },
        { "type": "CARD", "cardTypes": ["DEBIT_CARD", "CREDIT_CARD"] }
      ]
    }
  },
  "disablePaymentRetry": true,
  "prefillUserLoginDetails": { "phoneNumber": "+919999999999" }
}
```

(`paymentFlow.message` and the exact `paymentModeConfig` nesting for web are taken from the mobile and SDK docs, so treat them as **unverified** for the web endpoint.)

Field rules:

| Field | Type | Req | Rules |
|---|---|---|---|
| `merchantOrderId` | String | Y | Max **63** chars. Only `_` and `-` allowed as special characters. Unique per merchant. |
| `amount` | Long | Y | **Paise**. Minimum **100** (₹1). |
| `expireAfter` | Long | N | Seconds, **300–3600** for Standard Checkout. Default applies if omitted. |
| `metaInfo.udf1..udf10` | String | N | Max 256 chars each |
| `metaInfo.udf11..udf15` | String | N | Max 50 chars, alphanumeric plus `_ - + @ .` |
| `paymentFlow.type` | String | Y | `PG_CHECKOUT` |
| `paymentFlow.merchantUrls.redirectUrl` | String | Y | Where the user lands after success or failure |
| `paymentFlow.paymentModeConfig` | Object | N | `enabledPaymentModes` **xor** `disabledPaymentModes` |
| `disablePaymentRetry` | Boolean | N | Disable PayPage retries |
| `prefillUserLoginDetails.phoneNumber` | String | Conditional | Accepts `+91 98...`, `98...` or `+9198...` |

- **Do not rename udf keys.** The docs say this causes production errors. The partner checklist says to use at most 5 udfs and omit empty ones (this conflicts with the 15 udfs in the API reference).

Responses:

```json
// 200 OK
{
  "orderId": "OMO123456789",
  "state": "PENDING",
  "expireAt": 1703756259307,
  "redirectUrl": "https://mercury-t2.phonepe.com/transact/uat_v2?token=..."
}
```

```json
// Duplicate merchantOrderId (an order exists and is not in CREATED state)
{ "code": "BAD_REQUEST", "message": "Please check the inputs you have provided." }
```

```json
// Server error: retry later
{ "code": "INTERNAL_SERVER_ERROR", "message": "There is an error trying to process your transaction at the moment. Please try again in a while." }
```

`expireAt` here is epoch **milliseconds**. Map the PhonePe `orderId` (prefix `OMO...`) to your `merchantOrderId`.

**TSP/partner extra headers** for pay: `X-MERCHANT-ID`, `X-SOURCE: API`, `X-SOURCE-CHANNEL`, `X-MERCHANT-IP`. Web adds `X-BROWSER-FINGERPRINT`, `USER-AGENT`, `X-MERCHANT-DOMAIN` and `X-SOURCE-REDIRECTION-TYPE` (`PARTNER_REDIRECTION` | `MERCHANT_REDIRECTION`). Android and iOS add `X-SOURCE-CHANNEL-VERSION` and `X-MERCHANT-APP-ID`.

### 5.3 Step 3: Redirect or iframe

See [section 4.1](#41-hosted-paypage-standard-checkout).

### 5.4 Step 4: Order status

| | Sandbox | Production |
|---|---|---|
| URL | `GET https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/{merchantOrderId}/status` | `GET https://api.phonepe.com/apis/pg/checkout/v2/order/{merchantOrderId}/status` |

Custom checkout uses `/payments/v2/order/{merchantOrderId}/status`. Subscriptions use `/subscriptions/v2/order/{merchantOrderId}/status`.

Query params:
- `details`: `true` returns all attempts in `paymentDetails`, `false` (default) returns only the latest.
- `errorContext`: `true` adds an `errorContext` block when the order is FAILED (default false).

Headers: `Content-Type`, `Authorization: O-Bearer ...`. Partners also send `X-MERCHANT-ID`.

Response (UPI, COMPLETED):

```json
{
  "orderId": "OMO2407021511185686967711",
  "state": "COMPLETED",
  "amount": 1000,
  "payableAmount": 1000,
  "feeAmount": 0,
  "expireAt": 1719913878566,
  "metaInfo": { "udf1": "", "udf2": "" },
  "paymentDetails": [
    {
      "transactionId": "OM2407021515097451914211",
      "paymentMode": "UPI_INTENT",
      "timestamp": 1719913509762,
      "amount": 1000,
      "payableAmount": 1000,
      "feeAmount": 0,
      "state": "COMPLETED",
      "rail": { "type": "UPI", "upiTransactionId": "YBL...", "vpa": "12****78@ybl" },
      "instrument": { "type": "ACCOUNT", "maskedAccountNumber": "******1234", "accountType": "SAVINGS" },
      "splitInstruments": [
        {
          "instrument": { "type": "ACCOUNT", "maskedAccountNumber": "******1234", "accountType": "SAVINGS" },
          "rail": { "type": "UPI", "utr": "4180xxxxxxx", "upiTransactionId": "YBL...", "vpa": "12****78@ybl" },
          "amount": 1000
        }
      ]
    }
  ]
}
```

Variants:
- **Card:** `paymentMode: "CARD"`, `instrument: { type: CREDIT_CARD, bankId, brn, geoScope, cardNetwork, maskedCardNumber }`, `rail: { type: "PG", authorizationCode }`.
- **Split (PPE_INTENT):** `splitInstruments` has an ACCOUNT/UPI entry plus a `WALLET` instrument with a `PPI_WALLET` rail.
- **No attempts yet:** `state: PENDING`, `paymentDetails: []`.
- **Failed:** top-level `errorCode` and `detailedErrorCode`, for example `"errorCode": "INVALID_MPIN"`. With `errorContext=true`:

```json
"errorContext": {
  "errorCode": "AUTHORIZATION_ERROR",
  "detailedErrorCode": "ZM",
  "source": "CUSTOMER",
  "stage": "AUTHENTICATION",
  "description": "Customer entered incorrect UPI PIN"
}
```

- **Unknown order:** `{ "code": "INVALID_MERCHANT_ORDER_ID", "message": "..." }`
- **Credit line:** adds `merchantId`, `merchantOrderId`, `currency`, `paymentFlow`, and `instrument.type: CREDIT_LINE` with `ifsc`, `bankId`, `providerAccountType`.

**Order states (root `state`):** `PENDING`, `COMPLETED`, `FAILED`. Create responses may show `CREATED` according to the docs table, while samples show `PENDING`. **Rely only on the root `state`**, never on individual attempts.

**Attempt states:** `PENDING`, `COMPLETED`, `FAILED`.

### 5.5 Recommended status-polling schedule (mandatory reconciliation)

From the partner checklist (v2) and the v1 checklist:

| Phase | Interval | Duration |
|---|---|---|
| First check | once | **20–25 s** after initiation |
| 1 | every **3 s** | next 30 s |
| 2 | every **6 s** | next 60 s |
| 3 | every **10 s** | next 60 s |
| 4 | every **30 s** | next 60 s |
| 5 | every **1 min** | until terminal state, or until `expireAfter` (v2). v1 says until timeout (**20 min**, or **15 min** on another page). |

The mobile SDK page suggests polling every 15 s, 30 s or 1 min while PENDING. The Order Status API is **mandatory** to implement (cron or scheduler) even when you use webhooks.

**PENDING UX options** (checklist):
1. Show a failure page, keep reconciling, and **auto-refund** if the payment later succeeds.
2. Show a pending page, keep reconciling, and fulfil only on COMPLETED.

### 5.6 Step 5: Webhook

See [section 9](#9-webhooks).

### 5.7 Step 6: Refund

| | Sandbox | Production |
|---|---|---|
| Initiate | `POST https://api-preprod.phonepe.com/apis/pg-sandbox/payments/v2/refund` | `POST https://api.phonepe.com/apis/pg/payments/v2/refund` |
| Status | `GET .../pg-sandbox/payments/v2/refund/{merchantRefundId}/status` | `GET https://api.phonepe.com/apis/pg/payments/v2/refund/{merchantRefundId}/status` |

Request:

```json
{
  "merchantRefundId": "Refund-id-12345",
  "originalMerchantOrderId": "Order-12345",
  "amount": 1234
}
```

| Field | Rules |
|---|---|
| `merchantRefundId` | Unique, max 63 chars |
| `originalMerchantOrderId` | The original `merchantOrderId` |
| `amount` | Paise, minimum 100 (some pages say 1). Total refunds cannot exceed the captured amount. |

Response: `{ "refundId": "OMRxxxxx", "amount": 1234, "state": "PENDING" }`

Refund status response:

```json
{
  "originalMerchantOrderId": "Order-12345",
  "amount": 100,
  "state": "COMPLETED",
  "timestamp": 1730869961754,
  "refundId": "OMR...",
  "errorCode": null,
  "detailedErrorCode": null,
  "splitInstruments": [
    {
      "amount": 100,
      "rail": { "type": "UPI", "utr": "...", "upiTransactionId": "...", "vpa": "12****78@ybl" },
      "instrument": { "type": "ACCOUNT", "maskedAccountNumber": "******1234", "accountType": "SAVINGS" }
    }
  ]
}
```

- Refund states: `PENDING`, `CONFIRMED`, `COMPLETED`, `FAILED`. Webhooks also mention `ACCEPTED` (`pg.refund.accepted`).
- **Rules:** while a refund is PENDING or CONFIRMED, keep polling and **don't** start another refund. On FAILED, retry with a **new** `merchantRefundId`. Track refunds with both webhooks **and** the status API (both are mandatory per the checklist).
- Partial refunds and multiple partial refunds are allowed up to the original amount.
- **Refund window: 90 days.** Error `REFUND_FOR_TXN_OLDER_THAN_LIMIT` covers payments older than that. `BF_034` / `REFUND_BREACHED` means insufficient forward-transaction balance on the MID.

---

## 6. Integration Flow v1 (legacy X-VERIFY checksum)

v1 is deprecated for new merchants. New dashboards issue v2 keys, and the WooCommerce FAQ says "if you see salt_key and salt_index these are V1 keys, ask for V2 keys". Many live integrations still use v1. Most official v1 pages now redirect, so the details below come from search snippets and community code.

### 6.1 Base URLs (v1)

| Env | Base |
|---|---|
| UAT | `https://api-preprod.phonepe.com/apis/pg-sandbox` |
| Prod | `https://api.phonepe.com/apis/hermes` |

### 6.2 v1 endpoints

| API | Method | Path | X-VERIFY string to hash |
|---|---|---|---|
| Pay | POST | `/pg/v1/pay` | `base64Body + "/pg/v1/pay" + saltKey` |
| Check status | GET | `/pg/v1/status/{merchantId}/{merchantTransactionId}` | `"/pg/v1/status/{merchantId}/{merchantTransactionId}" + saltKey` |
| Refund | POST | `/pg/v1/refund` | `base64Body + "/pg/v1/refund" + saltKey` |
| Refund status | GET | `/pg/v1/status/{merchantId}/{refundMerchantTransactionId}` (Jentic also lists `/pg/v1/refund/{merchantId}/{merchantTransactionId}`, unverified) | path + saltKey |
| VPA validate | POST | `/pg/v1/vpa/validate` (Jentic lists `/pg/v1/validate/vpa`, unverified) | body + path + saltKey |
| Legacy status (v3) | GET | `/v3/transaction/{merchantId}/{transactionId}/status` | (legacy) |

**Checksum formula:**

```
X-VERIFY = SHA256_HEX( <payload-or-empty> + <api path> + <saltKey> ) + "###" + <saltIndex>
```

Callback verification: `SHA256_HEX(base64Response + saltKey) + "###" + saltIndex`.

### 6.3 Pay API (v1)

Headers: `Content-Type: application/json`, `X-VERIFY: <checksum>`. Optional headers `X-CALLBACK-URL` and `X-REDIRECT-URL` existed in some versions (unverified).

Body: `{ "request": "<base64(JSON payload)>" }`

Decoded payload:

```json
{
  "merchantId": "PGTESTPAYUAT",
  "merchantTransactionId": "MT7850590068188104",
  "merchantUserId": "MUID123",
  "amount": 10000,
  "redirectUrl": "https://webhook.site/redirect-url",
  "redirectMode": "REDIRECT",
  "callbackUrl": "https://webhook.site/callback-url",
  "mobileNumber": "9999999999",
  "paymentInstrument": { "type": "PAY_PAGE" }
}
```

| Field | Rules |
|---|---|
| `merchantId` | Under 38 chars |
| `merchantTransactionId` | Under 35 chars, unique, alphanumeric plus `_` and `-` |
| `merchantUserId` | Under 36 chars. Mandatory for PAY_PAGE, CARD and SAVED_CARD. |
| `amount` | Paise, at least 100 |
| `redirectUrl` | Browser return URL |
| `redirectMode` | `REDIRECT` (GET) or `POST`. Use POST only if your URL handles POST. |
| `callbackUrl` | S2S POST callback |
| `mobileNumber` | Optional, no spaces |
| `paymentInstrument.type` | `PAY_PAGE`, `UPI_INTENT` (with `targetApp`), `UPI_COLLECT` (with `vpa`), `UPI_QR`, `CARD`, `SAVED_CARD`, `TOKEN`, `NET_BANKING` (with `bankId`) |
| `deviceContext.deviceOS` | For UPI_INTENT: `ANDROID` or `IOS` |

Node example (community):

```js
const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
const xVerify = crypto.createHash('sha256')
  .update(payloadB64 + '/pg/v1/pay' + SALT_KEY).digest('hex') + '###' + SALT_INDEX;
await axios.post(`${BASE}/pg/v1/pay`, { request: payloadB64 }, {
  headers: { 'Content-Type': 'application/json', 'X-VERIFY': xVerify }
});
```

Response:

```json
{
  "success": true,
  "code": "PAYMENT_INITIATED",
  "message": "Payment initiated",
  "data": {
    "merchantId": "PGTESTPAYUAT",
    "merchantTransactionId": "MT7850590068188104",
    "instrumentResponse": {
      "type": "PAY_PAGE",
      "redirectInfo": {
        "url": "https://mercury-uat.phonepe.com/transact/simulator?token=...",
        "method": "GET"
      }
    }
  }
}
```

`redirectInfo` may also include `headers` and `data` (form data for a POST redirect). For UPI_INTENT the response has `instrumentResponse.intentUrl`; for UPI_QR it has `qrData` (unverified).

### 6.4 Check Status (v1)

Headers: `Content-Type: application/json`, `X-VERIFY: SHA256("/pg/v1/status/{mid}/{mtid}" + saltKey) + "###" + saltIndex`, `X-MERCHANT-ID: <mid>`.

```json
{
  "success": true,
  "code": "PAYMENT_SUCCESS",
  "message": "Your request has been successfully completed.",
  "data": {
    "merchantId": "PGTESTPAYUAT",
    "merchantTransactionId": "MT7850590068188104",
    "transactionId": "T2111221437456190170379",
    "amount": 10000,
    "state": "COMPLETED",
    "responseCode": "SUCCESS",
    "paymentInstrument": { "type": "UPI", "utr": "206378866112" }
  }
}
```

- Card variant: `paymentInstrument` has `type: CARD`, `cardType`, `pgTransactionId`, `bankTransactionId`, `pgAuthorizationCode`, `arn`, `bankId`, `brn`.
- Net banking: `pgTransactionId`, `pgServiceTransactionId`, `bankTransactionId`, `bankId` (unverified).
- Failed: `state: FAILED`, `responseCode` (for example `ZM`), `paymentInstrument: null`.
- `data.state`: `PENDING` | `COMPLETED` | `FAILED`. `responseCode` is informational and new values may appear, so don't use a strict enum.

### 6.5 v1 response codes (top-level `code`)

| Code | Meaning | Action |
|---|---|---|
| `PAYMENT_INITIATED` | Pay request accepted; redirect the user | Redirect |
| `PAYMENT_SUCCESS` | Payment successful (or refund successful) | Fulfil |
| `PAYMENT_ERROR` | Payment failed | Mark failed |
| `PAYMENT_PENDING` | Still in progress, **not** a failure | Poll per schedule |
| `PAYMENT_DECLINED` | Declined by user | Mark failed |
| `TIMED_OUT` | Timed out (exists in some v1 lists, unverified) | Mark failed after status confirms |
| `BAD_REQUEST` | Invalid request | Fix the request |
| `AUTHORIZATION_FAILED` | Wrong X-VERIFY | Fix the checksum |
| `TRANSACTION_NOT_FOUND` | Not initiated at PhonePe | Treat as not paid (after the window) |
| `INTERNAL_SERVER_ERROR` | Unknown | Call status before acting |

### 6.6 Refund (v1)

Decoded payload:

```json
{
  "merchantId": "PGTESTPAYUAT",
  "merchantUserId": "MUID123",
  "originalTransactionId": "MT7850590068188104",
  "merchantTransactionId": "RF7850590068188105",
  "amount": 10000,
  "callbackUrl": "https://merchant.example.com/phonepe/refund-callback"
}
```

- `merchantTransactionId` must differ from the debit transaction's ID.
- `amount` cannot exceed the original amount and must be at least 100 paise.
- Errors: `AUTHORIZATION_FAILED` (bad X-VERIFY) and `TRANSACTION_NOT_FOUND` (original not found). On `INTERNAL_SERVER_ERROR` or `TIMED_OUT` the refund **may** have been initiated, so check status before retrying.
- The refund callback is a POST with the same payload as the refund status response and an X-VERIFY header.

### 6.7 v1 S2S callback

- POST to `callbackUrl` with body `{"response": "<base64 JSON>"}` and header `X-VERIFY: SHA256(base64 + saltKey)###saltIndex`.
- The decoded JSON matches the status response (`success`, `code`, `message`, `data{...}`).
- **Validate the checksum and the amount** before trusting it. "Completion of a transaction does not imply that payment is successful."
- If no callback has arrived by the time the user is redirected back, a status API check is **mandatory**.

---

## 7. Custom Checkout (S2S instrument APIs)

Endpoint: `POST {base}/payments/v2/pay` with `paymentFlow.type: "PG"`. Status: `GET /payments/v2/order/{merchantOrderId}/status`.

| `paymentMode.type` | Key fields | Response | `expireAfter` |
|---|---|---|---|
| `UPI_INTENT` | `targetApp`, `deviceContext.deviceOS`, `deviceContext.merchantCallBackScheme` (iOS) | `intentUrl` | 300–5,184,000 s, default **600** |
| `UPI_COLLECT` | `details: { type: VPA, vpa }` or `{ type: UPI_NUMBER, upiNumber }`, `message`. Validate the VPA first. | `orderId`, `state`, `expireAt` | default **480** |
| `UPI_QR` | (none) | `intentUrl` / QR data | (unverified) |
| `CARD` | `authMode: "3DS"`, `cardDetails { encryptedCardNumber, encryptionKeyId, encryptedCvv, expiryMonth, expiryYear, cardHolderName }`, `merchantUrls.redirectUrl` | `redirectUrl` (3DS) | |
| `TOKEN` | Saved-card network token plus encrypted CVV, `merchantUrls.redirectUrl` | `redirectUrl` | |
| `NET_BANKING` | `bankId` (for example `SBIN`), `merchantUrls.redirectUrl` | `redirectUrl` | |

UPI Intent request (Android):

```json
{
  "merchantOrderId": "TX123456",
  "amount": 1000,
  "expireAfter": 1200,
  "deviceContext": { "deviceOS": "ANDROID" },
  "paymentFlow": {
    "type": "PG",
    "paymentMode": { "type": "UPI_INTENT", "targetApp": "com.phonepe.app" }
  }
}
```

Response: `{ "orderId": "OMO123456789", "state": "PENDING", "expireAt": 1703756259307, "intentUrl": "ppe://url" }`

UPI Collect request:

```json
{
  "merchantOrderId": "TX123456",
  "amount": 1000,
  "paymentFlow": {
    "type": "PG",
    "paymentMode": {
      "type": "UPI_COLLECT",
      "details": { "type": "VPA", "vpa": "success@ybl" },
      "message": "Order TX123456"
    }
  }
}
```

**Card custom flow requirements:**
- The merchant must be **PCI DSS certified**.
- Card number and CVV are encrypted with **RSA-4096, `RSA/ECB/PKCS1Padding`** using an `encryptionKey` and `encryptionKeyId` issued per MID. Don't hardcode them.

---

## 8. Mobile SDKs

### 8.1 Create SDK order (backend)

`POST {base}/checkout/v2/sdk/order` (custom and native: `/payments/v2/sdk/order`)

```json
{
  "merchantOrderId": "TX123",
  "amount": 1000,
  "expireAfter": 1200,
  "metaInfo": { "udf1": "..." },
  "paymentFlow": {
    "type": "PG_CHECKOUT",
    "paymentModeConfig": { "disabledPaymentModes": [ { "type": "UPI_COLLECT" } ] }
  }
}
```

Response: `{ "orderId": "OMO...", "state": "PENDING", "expireAt": 1703756259307, "token": "<order token>" }`

### 8.2 Android (native)

```kotlin
// settings / project build.gradle
maven { url = uri("https://phonepe.mycloudrepo.io/public/repositories/phonepe-intentsdk-android") }
// app build.gradle
implementation("phonepe.intentsdk.android.release:IntentSDK:5.4.0")

val ok = PhonePeKt.init(
    context = this,
    merchantId = "MID",
    flowId = "USER_OR_RANDOM_ID",
    phonePeEnvironment = PhonePeEnvironment.SANDBOX, // RELEASE in prod
    enableLogging = false,
    appId = null
)
PhonePeKt.startCheckoutPage(context = this, token = token, orderId = orderId, activityResultLauncher = launcher)
// In the launcher result, call your backend, which checks the webhook or Order Status
```

- minSdk 21. compileSdk and targetSdk 28 or higher.
- If `init` returns `false`, the SDK is unusable.

### 8.3 iOS

- Distributed via CocoaPods (pod name unverified, likely `PhonePePayment`).
- Add `LSApplicationQueriesSchemes` to Info.plist: `ppemerchantsdkv1`, `ppemerchantsdkv2`, `ppemerchantsdkv3`, `paytmmp`, `gpay` (plus others for more UPI apps).
- Register a URL Type (custom scheme, must start with a letter, using only letters, digits, `.` and `-`) for returning to the app.
- The iOS test app is distributed via Firebase.

### 8.4 React Native

- `npm i react-native-phonepe-pg` (SDK v3.1.1, tested with RN 0.72.3). Add the Android maven repo, then run `pod install`.
- `PhonePePaymentSDK.init(environment: "SANDBOX"|"PRODUCTION", merchantId, flowId, enableLogging)` returns a Promise. On iOS, a missing appId returns `FALSE`.
- `PhonePePaymentSDK.startTransaction(requestString, appSchema /* iOS only */)`. The request is a JSON string: `{ orderId, merchantId, token, paymentMode: { type: "PAY_PAGE" } }`.
- Result: `{ status: "SUCCESS" | "FAILURE" | "INTERRUPTED", error?: string }`.

### 8.5 Flutter

- `flutter pub add phonepe_payment_sdk`. Latest is about 3.0.x.
- Same init and startTransaction model as React Native. The same iOS plist entries are needed.
- Flutter Web: wrap `PhonePeCheckout.transact` via `js.context.callMethod`.

### 8.6 Others

An Ionic/Cordova SDK is mentioned in the FAQ. The **SDK-less** path also works: use the `UPI_INTENT` custom API and launch `intentUrl` yourself.

---

## 9. Webhooks

### 9.1 Setup

1. Dashboard → toggle **Test Mode** (ON for sandbox, OFF for production).
2. **Developer Settings → Webhook → Create Webhook**.
3. Choose an auth type:
   - **SHA (Basic):** Webhook URL, **Username**, **Password**, Description, Active Events.
   - **HMAC:** Webhook URL, Events, Description. PhonePe then generates a **Checksum Secret Key** and **Webhook ID**.
4. Click **Create**.

Partners (TSPs) have List, Update and Delete webhook APIs, and only partner-level webhooks are supported.

Requirements:
- HTTPS with a valid certificate. No IP addresses or port numbers in the URL.
- Accept POST.
- Return **2xx within 3–5 s**.

### 9.2 Authentication

**SHA mode:** PhonePe sends `Authorization: <hex SHA256 of "username:password">`. Recompute it and compare. If it doesn't match, ignore the payload (treat it as fraud) and call Order Status.

```js
const expected = crypto.createHash('sha256').update(`${user}:${pass}`).digest('hex');
if (req.headers['authorization'] !== expected) return res.status(401).end();
```

Use a constant-time compare. Some SDKs may send a `SHA256 ` prefix (unverified).

**HMAC mode:** the request headers carry the key ID and signature (`x-phonepe-checksum-key-id` and `x-phonepe-checksum-signature`; the docs are inconsistent). Compute the HMAC over the **raw body** with the stored secret and compare. The exact algorithm is not documented; HMAC-SHA256 is likely (unverified).

**Backend SDK helper:** `client.validateCallback(username, password, authorizationHeader, rawBody)` returns `CallbackResponse { type, payload }`. Python uses `validate_callback`.

### 9.3 Event names

| Event | SDK `CallbackType` | Trigger |
|---|---|---|
| `checkout.order.completed` | `CHECKOUT_ORDER_COMPLETED` | Order paid (also autopay setup success) |
| `checkout.order.failed` | `CHECKOUT_ORDER_FAILED` | Order failed or expired |
| `pg.order.completed` / `pg.order.failed` | (custom checkout and native SDK naming, verify) | Custom checkout orders |
| `pg.refund.accepted` | `PG_REFUND_ACCEPTED` | Refund accepted, not final |
| `pg.refund.completed` | `PG_REFUND_COMPLETED` | Refund successful |
| `pg.refund.failed` | `PG_REFUND_FAILED` | Refund failed |
| `subscription.paused` / `subscription.unpaused` | | User paused or unpaused a mandate |
| `subscription.revoked` | | User revoked the mandate in their UPI app |
| `subscription.cancelled` | | Merchant cancelled |
| `subscription.notification.completed` / `.failed` | | Pre-debit notification result |
| `subscription.redemption.order.completed` / `.failed` | | Recurring debit order result |
| `subscription.redemption.transaction.completed` / `.failed` | | Debit attempt result |
| `subscription.setup.order.completed` / `.failed` | | eNACH / setup (listed in the eNACH docs) |
| `payment.dispute.created`, `.under_review`, `.action_required`, `.won`, `.lost` | | Chargebacks |

### 9.4 Payload (order)

```json
{
  "event": "checkout.order.completed",
  "payload": {
    "orderId": "OMO1708...",
    "merchantId": "MERCHANTUAT",
    "merchantOrderId": "TX123",
    "state": "COMPLETED",
    "amount": 10000,
    "expireAt": 1724866793837,
    "metaInfo": { "udf1": "", "udf2": "" },
    "paymentDetails": [
      {
        "paymentMode": "UPI_QR",
        "transactionId": "OM12334",
        "timestamp": 1724866793837,
        "amount": 10000,
        "state": "COMPLETED"
      }
    ]
  }
}
```

Failed attempts include `"errorCode": "AUTHORIZATION_ERROR"` and `"detailedErrorCode": "ZM"` inside `paymentDetails`.

Refund payload: `{ "event": "pg.refund.completed", "payload": { merchantId, merchantRefundId, originalMerchantOrderId, refundId, amount, state, timestamp, splitInstruments[], paymentDetails[] } }`

### 9.5 Rules

- Use the `event` field. The old `type` field is deprecated.
- Use only root `payload.state` for status.
- Don't deserialize strictly, because new fields get added.
- `expireAt` and `timestamp` are epoch **ms**.
- Handle duplicates idempotently.
- **Retries:** PhonePe retries callbacks that don't get a 200 (per the PHP SDK docs). The schedule and count are **not documented**.
- **IP allowlist** (PhonePe proxy IPs):
  - 103.116.33.8–.11, 103.116.33.136–.139
  - 103.116.32.16–.29
  - 103.116.34.1, 103.116.34.16–.23
  - 103.243.35.242
  - CIDRs: 103.116.34.16/29, 103.116.32.16/29, 103.116.33.8/30, 103.116.33.136/30

---

## 10. Payment Links

### 10.1 API

| API | Method | Path |
|---|---|---|
| Auth | POST | `/v1/oauth/token` |
| Create | POST | `/paylinks/v1/pay` |
| Status | GET | `/paylinks/v1/{merchantOrderId}/status` |
| Cancel | POST | `/paylinks/v1/{merchantOrderId}/cancel` |
| Notify (resend) | POST | `/paylinks/v1/notify` with order ID and a boolean "notify to mobile" |
| Refund | POST | `/payments/v2/refund` |
| Refund status | GET | `/payments/v2/refund/{merchantRefundId}/status` |

- The create response includes `orderId`, `state` (`CREATED`), the expiry (epoch) and **`paylinkUrl`**.
- Links are **fixed amount**, can have an expiry, and can be single-use.
- Instruments: UPI, cards, net banking.
- Request field names for customer details and expiry were not retrieved (unverified). They are likely `customerDetails { name, phoneNumber, email }`, `expireAt` and `paymentFlow.type: "PAYLINK"`.

### 10.2 Dashboard

**Payment links → New paylinks → Single payment link**, then the form, then **Generate link**.

| Field | Notes |
|---|---|
| Amount | Fixed |
| Payment request for | Description shown at checkout |
| Customer Name | |
| Reference ID | Your order number |
| Email ID | The link is emailed |
| Phone Number | The link is sent by SMS |
| Link Expire Date | Defaults to **1 month** from creation |

- Statuses: **Active**, **Completed** (paid; one successful payment per link), **Cancelled**, **Expired**, **Failed** (up to **3 attempts** per link).
- Actions: Copy link, Cancel, **Reshare**.
- Branding from Settings applies.
- Bulk links: a "Bulk" option likely exists (unverified).

---

## 11. Autopay / Subscriptions (UPI mandates)

### 11.1 Endpoints

| API | Method | Path |
|---|---|---|
| Subscription setup (custom, UPI intent or collect) | POST | `/subscriptions/v2/setup` |
| Setup via Standard Checkout | POST | `/checkout/v2/pay` with `paymentFlow.type: SUBSCRIPTION_CHECKOUT_SETUP` |
| Setup via Payment Link | POST | `/paylinks/v1/pay` with `SUBSCRIPTION_PAYLINK_SETUP` |
| Setup order status | GET | `/subscriptions/v2/order/{merchantOrderId}/status` |
| Subscription status | GET | `/subscriptions/v2/{merchantSubscriptionId}/status` |
| Notify (pre-debit) | POST | `/subscriptions/v2/notify` (one page says `/checkout/v2/subscriptions/notify`) |
| Execute (redeem) | POST | `/subscriptions/v2/redeem` |
| Redemption order status | GET | `/subscriptions/v2/order/{merchantOrderId}/status` |
| Cancel | POST | `/subscriptions/v2/{merchantSubscriptionId}/cancel` |
| Pause / Unpause, Revoke | (documented in the sidebar, paths unverified) | |
| Refund | POST | `/payments/v2/refund` |

### 11.2 Setup request

```json
{
  "merchantOrderId": "M27",
  "amount": 100,
  "expireAt": 1807681114000,
  "paymentFlow": {
    "type": "SUBSCRIPTION_SETUP",
    "merchantSubscriptionId": "MS27",
    "authWorkflowType": "TRANSACTION",
    "amountType": "FIXED",
    "maxAmount": 100,
    "frequency": "ON_DEMAND",
    "expireAt": 1807681114000,
    "paymentMode": { "type": "UPI_INTENT", "targetApp": "com.phonepe.app" }
  },
  "deviceContext": { "deviceOS": "ANDROID" },
  "metaInfo": { "udf1": "..." }
}
```

| Field | Values and rules |
|---|---|
| `authWorkflowType` | `TRANSACTION` (first debit at setup; amount at least 100 paise or the first debit amount) or `PENNY_DROP` (amount **must be 200** paise, refunded) |
| `amountType` | `FIXED` or `VARIABLE` (`maxAmount` acts as the cap) |
| `frequency` | `DAILY`, `WEEKLY`, `MONTHLY`, `FORTNIGHTLY`, `BIMONTHLY`, `QUARTERLY`, `HALFYEARLY`, `YEARLY`, `ON_DEMAND` |
| `paymentFlow.expireAt` | Mandate validity end, epoch ms. Default **30 years**. |
| top `expireAt` | Order expiry. Intent expiry is capped at **15 min**. |

Response: `{ "orderId": "OMO...", "state": "PENDING", "intentUrl": "upi://mandate?...&txnType=CREATE&amrule=MAX&recur=ASPRESENTED...", "nativeOtpEnabled": false }`

### 11.3 Redemption (recurring debit)

1. Check that the subscription is `ACTIVE` via Subscription Status.
2. **Notify** (pre-debit notification to the customer, per NPCI rules). The `paymentFlow` fields include `merchantSubscriptionId`, `redemptionRetryStrategy` (`STANDARD` | `CUSTOM`) and `autoDebit` (bool). The response and webhook carry `validAfter`, `validUpto`, `notifiedAt`, and state `NOTIFIED`.
3. **Execute (redeem)** at least **24 h** after notify. This step is needed only if `autoDebit=false`; with `true`, PhonePe debits automatically.
4. **Retries:**
   - `STANDARD`: PhonePe-managed, up to a **48 h** window.
   - `CUSTOM`: one initial attempt plus 3 retries within 48 h, and only in non-peak windows (**21:31–09:59** and **13:01–16:59**).

### 11.4 Subscription states

`ACTIVATION_IN_PROGRESS`, `ACTIVE`, `EXPIRED`, `FAILED`, `CANCEL_IN_PROGRESS`, `CANCELLED`, `REVOKE_IN_PROGRESS`, `REVOKED`, `PAUSE_IN_PROGRESS`, `PAUSED` (with `pauseStartDate`/`pauseEndDate`), `UNPAUSE_IN_PROGRESS`.

UPI AutoPay regulatory notes (NPCI general rules, not PhonePe-specific): above ₹15,000 per debit (₹1 lakh for some categories such as insurance, MF and credit card bills) the customer needs AFA/PIN for each debit. Pre-debit notification must be sent at least 24 h before the debit.

---

## 12. Offline: QR, SmartSpeaker, POS/EDC

The "In-store Payments" docs live at `developer.phonepe.com/offline-integration`. These use **X-VERIFY (v3-style)** APIs, not OAuth.

| Solution | Key APIs |
|---|---|
| **Dynamic QR (DQR)** | `POST /v3/qr/init` with `merchantId`, `transactionId`, `amount`, `storeId`, `terminalId`, `expiresIn`; X-VERIFY = SHA256(base64 + "/v3/qr/init" + saltKey)###idx. Returns QR string. Then status via `/v3/transaction/{mid}/{txnId}/status` and S2S callback. Also: cancel, refund (`/v3/credit/backToSource`), check payment status |
| **Integrated Static QR** | StaticQR Init, Enable, Disable APIs, **Transaction List API**, StaticQR S2S callback. Older callback checksum: `SHA256(MerchantId+TransactionId+Amount+SaltKey)###idx` |
| **Intent generation solution** | Generate a UPI intent for in-store or kiosk use |
| **Integrated EDC (POS card machine)** | EDC Sale Request, EDC S2S Callback, EDC StatusCheck, EDC Txn Search, EDC UAT testing |
| **SmartSpeaker** | Voice announcement of received payments, mapped to QR or store. Managed in the app or dashboard (no public API found). |
| **Collect request APIs (v3)** | `/v3/charge`, `/v3/credit/backToSource` (refund with `originalTransactionId` **or** `providerReferenceId`, only one) |

Dashboard: **Mapped QR Codes**, Stores, Terminals, notification receivers (who hears SmartSpeaker or SMS alerts).

---

## 13. Error Codes, Rate Limits, Idempotency, Reconciliation

### 13.1 HTTP-level

| HTTP | Meaning | Action |
|---|---|---|
| 200 | OK | |
| 400 | Bad request. Missing or blank mandatory params, undocumented params, wrong types, duplicate `merchantOrderId` | Fix the request |
| 401 | Invalid or expired token, or UAT/prod mismatch | Regenerate the token |
| 404 | Wrong path or resource | Check the endpoint |
| 500 | Server error. In UAT, often a missing simulator template. | Retry with backoff, check status |

### 13.2 API `code` values (v2)

`BAD_REQUEST`, `INTERNAL_SERVER_ERROR`, `INVALID_MERCHANT_ORDER_ID`, `AUTHORIZATION_FAILED`, `TOO_MANY_REQUESTS` (unverified), `ORDER_NOT_FOUND` (unverified).

### 13.3 Payment error codes (`errorCode` / `detailedErrorCode`)

Each detailed error has `code`, `stage`, `source` and `description`.

| Code | Stage | Source | Meaning |
|---|---|---|---|
| `Z9` / `INSUFFICIENT_BALANCE` | AUTHORIZATION | CUSTOMER | Insufficient funds |
| `ZM` / `INVALID_MPIN` | AUTHENTICATION | CUSTOMER | Wrong UPI PIN |
| `Z6` / `MPIN_LIMIT_BREACHED` | AUTHENTICATION | CUSTOMER | Too many wrong-PIN attempts |
| `UT` / `BANK_TECHNICAL_ISSUE` | AUTHORIZATION | ISSUING_BANK | Bank slow or down |
| `REQUEST_TIME_OUT` | TXN_NOT_COMPLETED | PRE_AUTHENTICATION | Payment request timed out |
| `ORDER_CANCELLED_BY_USER` | TXN_CANCELLED | PRE_AUTHENTICATION | User cancelled |
| `PENDING` | AUTHORIZATION | ISSUING_BANK | Still processing; recheck after about 15 min |
| `AUTHORIZATION_ERROR` | (generic `errorCode`, paired with a detailed code such as ZM) | | |
| `BF_034` / `REFUND_BREACHED` | PRE_AUTHENTICATION | PAYMENT_GATEWAY | Insufficient forward balance to refund |
| `REFUND_FOR_TXN_OLDER_THAN_LIMIT` | REFUND | BUSINESS | Payment older than **90 days** |
| `INTERNAL_SECURITY_BLOCK_1` | PRE_AUTHENTICATION | PAYMENT_GATEWAY | Payment URL or referrer doesn't match onboarding |
| `U16_NPCI_TXNRISK_*` | | NPCI | NPCI risk blocks (velocity or amount) |

Sources (`source` enum seen): `CUSTOMER`, `ISSUING_BANK`, `PAYMENT_GATEWAY`, `BUSINESS`, `PRE_AUTHENTICATION`, `NPCI`.
Stages: `PRE_AUTHENTICATION`, `AUTHENTICATION`, `AUTHORIZATION`, `TXN_NOT_COMPLETED`, `TXN_CANCELLED`, `REFUND`.

### 13.4 Rate limits

- **Not publicly documented.** No TPS or 429 info was found (unverified).
- The only explicit guidance is to **avoid calling the auth API per request** and to follow the polling schedule rather than hammering the status API.

### 13.5 Idempotency

- There is no `Idempotency-Key` header. Idempotency comes from **merchant-generated IDs**:
  - `merchantOrderId`: a reused ID for an order not in CREATED state returns `BAD_REQUEST`.
  - `merchantRefundId`: unique per refund. On FAILED, retry with a **new** ID. While PENDING or CONFIRMED, never create another refund.
  - `merchantSubscriptionId`: unique per mandate.
  - v1 `merchantTransactionId`: unique per pay or refund.
- Webhooks can be delivered more than once, so dedupe on `(event, merchantOrderId/refundId, state)`.

### 13.6 Reconciliation

- Webhooks first, the polling schedule (section 5.5) as a fallback, and a final check at expiry.
- **Daily:** match the settlement report (`PhonePeReferenceId` and `MerchantReferenceId`) against the orders DB, and check fees and GST.
- Late success after the order is shown as failed: auto-refund (checklist option 1).
- Pull the transaction or refund reports from the dashboard (async generation, emailed, downloadable).

---

## 14. Refunds, Settlements, Disputes/Chargebacks

### 14.1 Refunds

- Channels: API (`/payments/v2/refund`), dashboard single refund (Transaction Details page, Admin, Finance Manager and Manager roles), and dashboard **Bulk Refund CSV**.
- Full and partial refunds are allowed, with multiple partial refunds up to the original amount. The window is **90 days**.
- Refunds go back to the source. Split payments are refunded per instrument.

| Original mode | Refund to | TAT |
|---|---|---|
| Credit or debit card | Card | 7–9 working days (average about 2 days, or 3–4 days for debit plus wallet) |
| UPI | Bank account via IMPS | Same or next day |
| Wallet | Wallet | Immediate |
| Card plus wallet | Split | Card 7–9 days, wallet immediate |
| UPI plus wallet | Split | Wallet immediate, UPI same or next day |
| External UPI app VPA | Customer account | 3 days |

- Reference numbers: UTR (UPI and account), ARN (card), none for wallet.

### 14.2 Settlements

- **T+1** (working days) by default for online and offline. Excludes Sundays, 2nd and 4th Saturdays and bank holidays. Payments from Friday to Sunday settle on Monday.
- The cycle can vary by transaction type, merchant and business model, and is agreed at commercial closure.
- Settlement is **net**: gross minus PhonePe fee minus GST (IGST or CGST plus SGST) minus refunds and adjustments (`EXCESS_RECOVERY`, `INVOICE_RECOVERY`, `SHORT_SETTLEMENT`).
- Mode `Auto-Settle`. Instant or early settlement ("SettleNow") is available for select merchants in the app (unverified for PG).
- Order Status responses include `feeAmount` and `payableAmount`. A separate "Order Status with Settlement" API variant exists (`/v1/reference/order-status-with-settlement-standard-checkout`, details unverified).

### 14.3 Disputes / Chargebacks

Base: `{sandbox|prod}/apis/pg[-sandbox]`

| API | Method | Path |
|---|---|---|
| Fetch dispute | GET | `/v1/disputes/{disputeId}` |
| List disputes | GET | `/v1/disputes?from=<epoch>&to=<epoch>&offset=<int>&limit=<int>&status=<status>` |
| Accept | POST | `/v1/disputes/{disputeId}/accept` |
| Contest | POST | `/v1/disputes/{disputeId}/contest` |
| Upload evidence | POST | `/v1/disputes/{disputeId}/evidences` |
| Delete evidence | DELETE | `/v1/disputes/{disputeId}/evidences/{evidenceId}` |

- Dispute object fields: `merchantId`, `disputeId`, `merchantOrderId`, `orderId`, `transactionId`, `transactionCompletedAt`, `transactionAmount`, `disputeAmount` (up to the transaction amount), `refundAmount`, `contestAmount`, `status`, `stage`, `dueDate` (response deadline, epoch ms), `createdAt`, `updatedAt`, `evidences`.
- `status`: `UNDER_REVIEW` → `ACTION_REQUIRED` (only if PhonePe finds the dispute valid) → `WON` | `LOST`.
- `stage`: `CHARGEBACK`, `PRE_ARBITRATION`.
- Webhooks: `payment.dispute.created`, `payment.dispute.under_review`, `payment.dispute.action_required`, `payment.dispute.won`, `payment.dispute.lost`.
- Response TAT (`dueDate`) is set per dispute. Industry norms are 5–7 days for cards and shorter for UPI (unverified for PhonePe).

---

## 15. Pricing

| Item | Info |
|---|---|
| Headline rate | **1.99%** shown on business.phonepe.com/standard-checkout with a "Limited Period Offer **FREE***" label (zero processing fee promo for new users, T&C apply) |
| Setup fee | ₹0 (claimed) |
| Annual maintenance | ₹0 (claimed) |
| UPI (P2M) | 0% MDR under current RBI/Government policy for most merchants. 2026 news: a proposed 0.4% MDR on UPI transactions above ₹2,000 for large merchants (Taxation and Other Laws (Amendment) Bill, 2026); small merchants with turnover under ₹1 lakh are exempt. Check the current status. |
| RuPay debit | Typically 0% |
| Visa/Mastercard debit | Industry about 0.4–0.9% (not PhonePe-specific) |
| Credit cards / net banking / wallet | Not publicly itemised. Likely within the 1.99% standard rate. Amex, international, EMI and corporate cards are typically higher (unverified). |
| GST | 18% on fees, shown as IGST or CGST plus SGST in the settlement report |
| Shopify app | Free to install, transaction fees billed per the PhonePe agreement |
| Chargeback fee | Not published (industry ₹200–500, unverified) |

---

## 16. Backend SDKs and Plugins

### 16.1 Backend SDKs (v2)

| Lang | Package / install | Client |
|---|---|---|
| Node.js | `pg-sdk-node` (npm `.tgz` from PhonePe-hosted repo) | `StandardCheckoutClient.getInstance(clientId, clientSecret, clientVersion, Env.SANDBOX \| Env.PRODUCTION)` |
| Python | pip from a PhonePe custom index (`phonepe` SDK, with PyPI as extra index) | `StandardCheckoutClient.get_instance(...)`, `pay(StandardCheckoutPayRequest.build_request(...))`, `get_order_status`, `refund`, `validate_callback` |
| Java | Maven (PhonePe repo), `pg-sdk-java` | `StandardCheckoutClient.getInstance(...)`, `pay`, `checkStatus`, `refund`, `validateCallback`, `createSdkOrder` |
| PHP | Composer | Same methods |
| .NET | NuGet (custom-checkout docs) | Same |

The SDKs handle token caching automatically. Exceptions: `PhonePeException` (code, message, httpStatusCode, data).

Legacy v1 SDKs existed for Java, Python, PHP and Node (`env`, `merchant_id`, `salt_key`, `salt_index`), with methods such as `pay`, `check_status`, `refund`, `verify_response`.

### 16.2 Plugins

| Platform | Notes |
|---|---|
| **WooCommerce**: "PhonePe Payment Solutions" (wordpress.org) | Configure under WooCommerce → Settings → Payments. v3.0.1+ fields: **Client ID, API Key (client secret), Client Version, Environment**. ≤2.0.11 used MID, Salt Key and Salt Key Index. Needs PHP ≥ 8.2 and plugin ≥ 3.0.4. **Production only (no UAT support).** If you see a 404 or stale settings, delete the `woocommerce_phonepe_settings` row in `wp_options`. A third-party plugin "Payment Gateway for PhonePe and for WooCommerce" also exists. |
| **Shopify** | Official app "PhonePe Payment Gateway" (launched Feb 24, 2023, free listing). UPI, cards, net banking. One-click UPI via the PhonePe app. |
| **Magento** | Listed on the marketing page (details unverified) |
| Others | Community: QuickPos (Node), Gallabox (WhatsApp paylinks), Zoho POS (offline), Ginesys |

---

## 17. Security and Compliance

- **RBI PA licence:** PhonePe is an authorised payment aggregator. Merchants are KYC'd per the RBI PA/PG guidelines and CKYCR.
- **PCI DSS:** Standard Checkout means the merchant needs **no PCI certificate**, because card data is entered on PhonePe. Custom card flow requires the merchant to be **PCI DSS certified**, with RSA-4096 encryption of PAN and CVV.
- **Card tokenisation:** RBI CoF tokenisation. Saved cards are tokens, so returning users enter only the CVV. Users manage tokens on the PhonePe PG portal.
- **Auth:**
  - v2 uses OAuth2 client_credentials with a short-lived `O-Bearer` token.
  - v1 uses an HMAC-like `X-VERIFY` (SHA256 over payload, path and salt) with a salt index for key rotation.
  - Webhooks use SHA256(username:password) or HMAC.
- **Fraud and risk (FRA):** referrer and domain allowlisting against onboarding data (`INTERNAL_SECURITY_BLOCK_1`), app package allowlisting, NPCI risk rules (`U16_NPCI_TXNRISK_*`).
- **TSP partner headers:** device fingerprint, merchant IP, merchant domain and app ID, used for risk.
- **Transport:** HTTPS only. Webhooks come from the published IP ranges.
- **Data:** VPAs and account numbers are masked in responses (`12****78@ybl`, `******1234`).

---

## 18. Design Takeaways for opengateway

Patterns worth copying, adapting or improving:

1. **Two auth generations.** OAuth client_credentials (`client_id`, `client_secret`, `client_version` for key rotation) is cleaner than v1 salt checksums. Consider offering both API keys (Basic) and HMAC request signing.
2. **Merchant-supplied IDs as idempotency keys** (`merchantOrderId`, `merchantRefundId`). Unlike PhonePe, also return the *existing* order on a duplicate create (idempotent replay) instead of `BAD_REQUEST`, or support an `Idempotency-Key` header.
3. **Order → attempts (`paymentDetails[]`) → split instruments (`rail` and `instrument`).** This models UPI, card, wallet and split payments well. Copy the "root `state` is the only truth" rule.
4. **Minimal state machine:** order `PENDING` → `COMPLETED` | `FAILED` (+ expiry via `expireAfter`). Refund `PENDING` → `CONFIRMED` → `COMPLETED` | `FAILED`. Subscription states as in section 11.4.
5. **Prescribed polling schedule** (20 s, then 3/6/10/30/60 s backoff). Publish a similar schedule and expose a status-sync job.
6. **Webhooks:** event names `checkout.order.completed`-style, `event` plus `payload` envelope, epoch-ms timestamps, tolerant deserialization. Improve on PhonePe by documenting the retry schedule, adding an event ID and timestamp to each delivery, and using a real HMAC-SHA256 body signature with a timestamp to prevent replay. PhonePe's SHA256(username:password) header is static and doesn't sign the body.
7. **Hosted checkout JS** with `transact({tokenUrl, type: IFRAME|REDIRECT, callback})` and `USER_CANCEL`/`CONCLUDED` UI callbacks only.
8. **`paymentModeConfig` enable/disable lists** for instrument control per order.
9. **`metaInfo.udf1..udf15`** echoed back in status and webhooks. Consider a free-form `notes` map instead (Razorpay-style).
10. **Sandbox simulator templates** (Success, Failure or Pending per MID), test VPAs (`success@`, `failed@`, `pending@`) and test cards with OTP `123456`. These are very useful to replicate.
11. **Dashboard IA:** Home KPIs, Transactions (Live and History, 6-month window), Refunds (single and bulk CSV), async Reports with history and download, Settlements by month with a UTR detail drawer, Users with 5 roles and store-level access, Profile (bank account read-only), Developer Settings (keys and webhooks), Branding, Help tickets, and a Test-mode toggle.
12. **Settlement report schema** (PaymentType, refs, Instrument, Amount, Fee, GST split, SettlementDate, UTR) is a good template for a recon export.
13. **Disputes API** (`/v1/disputes` list, fetch, accept, contest, evidences) with `status` plus `stage` and `dueDate`.

---

## 19. Gaps and Unverified Items

- **v1 docs** mostly redirect or 404. The exact v1 redirect POST fields (`code`, `merchantId`, `transactionId`, `amount`, `providerReferenceId`, `checksum`), the v1 refund status path, the VPA validate path, `TIMED_OUT` and the net banking status fields are **unverified**.
- **Token TTL:** the sample implies about 7 days. Real TTL is unverified; always use `expires_at`.
- **Webhook retry schedule and count:** not documented. The HMAC algorithm is not named.
- **Event naming:** `checkout.order.*` (Standard Checkout) versus `pg.order.*` (custom and native SDK pages). Verify in the sandbox.
- **Rate limits / 429:** not published.
- **Pricing:** no official per-instrument rate card. Only the 1.99% headline and the "FREE" promo were found.
- **Payment Links create request schema** (customer details, expiry field names) was not retrieved. API-side link states were not retrieved; the dashboard states are Active, Completed, Cancelled, Expired and Failed.
- **Autopay** pause, unpause and revoke endpoint paths; notify endpoint path conflict.
- **iOS pod name**, Flutter/RN latest versions (RN SDK 3.1.1, Flutter about 3.0.2 per docs at research time).
- **Dashboard:** Developer Settings UI details, the Disputes UI, report file formats, the bulk refund CSV column names, and the Payment Links list columns.
- **Magento plugin**, PG Bolt, EMI and Offers APIs: not researched in depth.
- **Some docs conflict:**
  - Refund minimum amount (1 vs 100 paise).
  - `expireAfter` max (3600 for Standard Checkout vs 5,184,000 for custom UPI).
  - Create response state (`CREATED` in tables vs `PENDING` in samples) and `expiryAt` vs `expireAt`.
  - The polling timeout in v1 (15 vs 20 min).
  - The udf count limit (15 in the API reference vs "max 5" in the partner checklist).
