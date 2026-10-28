# OpenGateway

OpenGateway is a self-hosted UPI payment gateway that serves many merchants, in the style of PhonePe PG. Customers pay with any UPI app, and the money goes **directly to each merchant's own UPI ID**. The platform never holds or routes money and charges 0% MDR. OpenGateway handles orders, the branded checkout, payment checks, webhooks and the merchant dashboard.

| Part | Path | Port |
|---|---|---|
| API + checkout SDK (Node 26, Express 5, `node:sqlite`) | [server/](server/) | 4000 |
| Web app: landing, signup and onboarding, dashboard, hosted checkout, docs (React, Vite, Tailwind) | [web/](web/) | 5173 (dev) |
| Example merchant store | [demo-store/](demo-store/) | 5050 |
| API contract | [SPEC.md](SPEC.md) | |
| Razorpay / Cashfree / PhonePe research | [knowledge/](knowledge/) | |

## Run it

```bash
npm install
npm run seed      # demo merchant: demo@opengateway.dev / demo12345 (keys in server/data/demo-credentials.json)
npm run dev       # server :4000, web :5173, demo store :5050
npm test          # 141 server tests (money safety, security, SMS parser, IDOR, webhooks)
npm run e2e       # 116 Playwright browser tests, desktop + mobile, with accessibility checks
```

To run it in production: `npm run build`, then `PUBLIC_URL=https://pay.yourdomain.com npm start`. The server then serves the built web app.

## How a payment works

1. The merchant's server calls `POST /v1/orders` (HTTP Basic auth with `key_id:key_secret`) and gets back a `payment_session_id` and a `checkout_url`.
2. The customer pays through `checkout.js`, which opens a modal, or by being redirected to `/pay/:session`:
   - On desktop, they scan a UPI QR code.
   - On mobile, they tap GPay, PhonePe, Paytm or BHIM.
3. The platform verifies the payment in one of three ways:
   - The merchant's phone forwards the bank's credit SMS to `/v1/observers/ingest?token=…` (any Android SMS-forwarder app will do). The server matches it to the order by its **unique payable amount** or by UTR.
   - The merchant marks the order paid in the dashboard.
   - In test mode, the simulator confirms it.
4. Once the order is `paid`:
   - The browser is sent back with `og_signature`, which is HMAC-SHA256 of `order_id|payment_id` keyed with the key secret.
   - Signed webhooks (`X-OpenGateway-Signature: t=…,v1=…`) are sent, with retries for up to 24 hours.

## Important limitations

- **Verification is not bank-grade.** It relies on bank SMS and manual confirmation, not on an acquiring bank or NPCI API. Always reconcile against your bank statement.
- **Refunds are recorded, not executed.** The merchant pays the customer back from their own UPI app, then marks the refund processed.
- **Compliance is your responsibility.** Check your bank's terms for collecting business payments on a UPI ID, and confirm with a CA whether your turnover requires GST registration. Do this before you charge merchants a platform fee or collect money on someone else's behalf, which may require RBI payment-aggregator authorisation.
- **It runs as a single server process.** Rate limits and the login lockout are held in memory. Data is stored in SQLite, and webhook deliveries are kept there, so they survive a restart.
- **The observer token is effectively a payment-confirming key.** Anyone who has it can post a fake "credit", so keep it secret and rotate it if it leaks.
- **Set `OG_STRICT_WEBHOOKS=1` on a public server.** Otherwise test-mode webhooks can reach localhost services.
- **`youpi-src/` is reference material only.** It is a clone of YouPI-PG, which has no license. None of its code is used here.
