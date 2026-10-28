import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { test, expect, createMerchant, v1, dash, ingest, creditSms, randomUtr, hmac, apiContext, checkoutApi, BASE_URL, type Merchant } from './fixtures';

const pathOf = (url: string) => new URL(url).pathname;

async function merchantWithOrder(data: Record<string, unknown> = {}) {
  const m = await createMerchant();
  const order = await v1(m, m.api).createOrder({ amount: 49900, receipt: 'rcpt_checkout', ...data });
  return { m, order };
}

function decodeQr(png: Buffer) {
  const img = PNG.sync.read(png);
  const res = jsQR(new Uint8ClampedArray(img.data), img.width, img.height);
  return res?.data ?? null;
}

test.describe('Hosted checkout', () => {
  test('desktop: QR is shown and encodes the right upi:// URI', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop layout only');
    const { m, order } = await merchantWithOrder();
    await page.goto(pathOf(order.checkout_url));
    await expect(page).toHaveTitle(`Pay ₹${(order.amount_payable / 100).toFixed(2)} · ${m.business_name}`);
    await expect(page.getByRole('heading', { name: 'Scan with any UPI app' })).toBeVisible();
    await expect(page.getByText(m.business_name).first()).toBeVisible();
    await expect(page.getByText('Test mode — no real money will move')).toBeVisible();
    await expect(page.getByRole('link', { name: /Google Pay|PhonePe/ })).toHaveCount(0);

    const qr = page.getByRole('img', { name: 'UPI QR code' });
    await expect(qr.locator("svg").first()).toBeVisible();
    // Hide the animated scan line so it can't obscure modules in the screenshot.
    await page.addStyleTag({ content: '[class*="animate-[scan"]{display:none!important}' });
    const data = decodeQr(await qr.screenshot({ scale: 'device', animations: 'disabled' }));
    expect(data, 'QR should decode').not.toBeNull();
    const uri = new URL(data!);
    expect(uri.protocol).toBe('upi:');
    expect(uri.searchParams.get('pa')).toBe(m.vpa);
    expect(uri.searchParams.get('pn')).toBe(m.business_name);
    expect(uri.searchParams.get('am')).toBe((order.amount_payable / 100).toFixed(2));
    expect(uri.searchParams.get('cu')).toBe('INR');
    expect(uri.searchParams.get('tr')).toBe(order.id);

    // Showing the QR registers a QR attempt on the order.
    await expect.poll(async () => (await dash(m, 'GET', `/api/orders/${order.id}`)).payments[0]?.flow).toBe('qr');
    await page.getByRole('button', { name: 'Copy to clipboard' }).first().click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(m.vpa);
  });

  test('mobile: UPI app buttons carry correct intent links', async ({ page, isMobile, allowConsole }) => {
    test.skip(!isMobile, 'mobile layout only');
    const { m, order } = await merchantWithOrder({ amount: 12345 });
    const session = await checkoutApi(m.api, order.payment_session_id).get();
    const query = session.upi.uri.slice(session.upi.uri.indexOf('?') + 1);
    await page.goto(pathOf(order.checkout_url));
    await expect(page.getByRole('heading', { name: 'Pay using a UPI app' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'UPI QR code' })).toHaveCount(0);

    const expected: [string, string][] = [
      ['Google Pay', `tez://upi/pay?${query}`],
      ['PhonePe', `phonepe://pay?${query}`],
      ['Paytm', `paytmmp://pay?${query}`],
      ['BHIM', `upi://pay?${query}`],
      ['Other UPI app', `upi://pay?${query}`],
    ];
    for (const [name, href] of expected) await expect(page.getByRole('link', { name })).toHaveAttribute('href', href);
    const params = new URLSearchParams(query);
    expect(params.get('pa')).toBe(m.vpa);
    expect(params.get('am')).toBe((order.amount_payable / 100).toFixed(2));
    expect(params.get('pn')).toBe(m.business_name);

    await page.getByRole('button', { name: 'Show QR to scan from another phone' }).click();
    await expect(page.getByRole('img', { name: 'UPI QR code' })).toBeVisible();
    await page.getByRole('button', { name: 'Pay with a UPI app on this phone' }).click();

    // Tapping an app records an intent attempt. The browser has no UPI app, so the hand-off itself fails quietly.
    allowConsole(/Failed to launch 'phonepe:\/\//);
    await page.getByRole('link', { name: 'PhonePe' }).click();
    await expect(page.getByText('Waiting for payment in your UPI app…')).toBeVisible();
    await expect.poll(async () => {
      const p = (await dash(m, 'GET', `/api/orders/${order.id}`)).payments[0];
      return p && `${p.flow}/${p.upi_app}`;
    }).toBe('intent/phonepe');
  });

  test('"I have paid": UTR validation → verifying → bank SMS → success → signed redirect', async ({ page, context }) => {
    const { m, order } = await merchantWithOrder({ return_url: 'https://merchant.example/return?cart=9' });
    const obs = await dash(m, 'POST', '/api/observers', { name: 'Phone', mode: 'test' });
    await context.route('https://merchant.example/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Merchant</title><h1>Back at the merchant</h1>' }));

    await page.goto(pathOf(order.checkout_url));
    await page.getByRole('button', { name: 'I have paid' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm your payment' })).toBeVisible();
    const utrInput = page.getByLabel(/UTR \/ UPI reference no/);
    await utrInput.fill('1234 5678');
    await page.getByRole('button', { name: 'Submit UTR' }).click();
    await expect(page.getByText("UTR is the 12-digit number in your UPI app's transaction details.")).toBeVisible();
    await expect(utrInput).toHaveAttribute('aria-invalid', 'true');
    // Letters are stripped as you type.
    await utrInput.fill('abc');
    await expect(utrInput).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Confirm without UTR' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'I have paid' }).click();

    const utr = randomUtr();
    await utrInput.fill(utr);
    await page.getByRole('button', { name: 'Submit UTR' }).click();
    await expect(page.getByRole('heading', { name: 'Verifying your payment…' })).toBeVisible();
    await expect.poll(async () => (await dash(m, 'GET', `/api/orders/${order.id}`)).payments[0]?.status).toBe('pending_verification');

    const res = await ingest(await apiContext(), obs.ingest_url, creditSms(order.amount_payable, utr));
    expect(res).toMatchObject({ status: 'matched', order_id: order.id });

    await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible();
    await expect(page.getByText(utr)).toBeVisible();
    await expect(page.getByText('Redirecting to merchant…')).toBeVisible();

    await page.waitForURL(/merchant\.example\/return/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('cart')).toBe('9');
    expect(url.searchParams.get('og_status')).toBe('paid');
    expect(url.searchParams.get('og_order_id')).toBe(order.id);
    const paymentId = url.searchParams.get('og_payment_id')!;
    expect(paymentId).toMatch(/^pay_/);
    expect(url.searchParams.get('og_signature')).toBe(hmac(m.key_secret, `${order.id}|${paymentId}`));
    await expect(page.getByRole('heading', { name: 'Back at the merchant' })).toBeVisible();
  });

  test('countdown runs and the expired screen shows when time is up', async ({ page }) => {
    // The server's minimum expiry is 120 s. Create a 120 s order, check the live countdown,
    // then shorten expires_at in the checkout API responses so the timer runs out in a few seconds.
    // (The page re-syncs to server_time on every poll, so faking the browser clock is not enough.)
    const { order } = await merchantWithOrder({ expire_in: 120 });
    expect(order.expires_at - order.created_at).toBe(120);
    await page.goto(pathOf(order.checkout_url));
    const countdown = page.getByText(/Expires in 0[12]:\d\d$/);
    await expect(countdown).toBeVisible();
    const before = await countdown.textContent();
    await expect(countdown).not.toHaveText(before!);

    let deadline: number | null = null;
    const shorten = async (route: import('@playwright/test').Route) => {
      const res = await route.fetch();
      const body = await res.json();
      deadline ??= body.server_time + 3;
      if (body.order) body.order.expires_at = deadline;
      else body.expires_at = deadline;
      await route.fulfill({ response: res, json: body });
    };
    await page.route(`**/api/checkout/${order.payment_session_id}`, shorten);
    await page.route(`**/api/checkout/${order.payment_session_id}/status`, shorten);
    await page.reload();
    await expect(page.getByText(/Expires in 00:0[0-3]$/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'This payment has expired' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'I have paid' })).toHaveCount(0);
  });

  test('cancel: keep paying, then cancel → cancelled screen → redirect with og_status=cancelled', async ({ page, context }) => {
    const { m, order } = await merchantWithOrder({ return_url: 'https://merchant.example/back' });
    await context.route('https://merchant.example/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Merchant</title><p>ok</p>' }));
    await page.goto(pathOf(order.checkout_url));
    await page.getByRole('button', { name: 'Cancel payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cancel this payment?' });
    await expect(dialog.getByRole('button', { name: 'Continue paying' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Continue paying' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Cancel payment' }).click();
    await dialog.getByRole('button', { name: 'Yes, cancel payment' }).click();
    await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible();
    await page.waitForURL(/merchant\.example\/back/, { timeout: 15_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('og_status')).toBe('cancelled');
    expect(url.searchParams.get('og_order_id')).toBe(order.id);
    expect(url.searchParams.get('og_signature')).toBeNull();
    expect((await dash(m, 'GET', `/api/orders/${order.id}`)).order.status).toBe('cancelled');

    // Re-opening a cancelled checkout shows the terminal screen straight away.
    await context.unroute('https://merchant.example/**');
    await context.route('https://merchant.example/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>ok</p>' }));
    await page.goto(pathOf(order.checkout_url));
    await expect(page.getByRole('heading', { name: 'Payment cancelled' })).toBeVisible();
  });

  test('simulate failure → "Payment not verified" → try again → simulate success', async ({ page }) => {
    const { m, order } = await merchantWithOrder();
    await page.goto(pathOf(order.checkout_url));
    await page.getByRole('button', { name: 'Simulate failure' }).click();
    await expect(page.getByRole('heading', { name: 'Payment not verified' })).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: /Scan with any UPI app|Pay using a UPI app/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'I have paid' })).toBeVisible();
    // Polling must not bounce us back to the failure screen.
    await page.waitForResponse((r) => r.url().includes('/status'));
    await page.waitForResponse((r) => r.url().includes('/status'));
    await expect(page.getByRole('heading', { name: 'Payment not verified' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Simulate success' }).click();
    await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible();
    await expect(page.getByText('You can close this page now.')).toBeVisible();
    expect((await dash(m, 'GET', `/api/orders/${order.id}`)).order.status).toBe('paid');
  });

  test('an invalid session id shows a friendly error', async ({ page }) => {
    await page.goto('/pay/ps_doesnotexist000000000000000');
    await expect(page.getByRole('heading', { name: 'Payment page unavailable' })).toBeVisible();
    await expect(page.getByText('This payment link is invalid or has been removed.')).toBeVisible();
  });

  test('embed mode via checkout.js: modal opens, success postMessage reaches the parent with a signature', async ({ page }) => {
    const { m, order } = await merchantWithOrder({ amount: 77700 });
    await page.goto(`http://127.0.0.1:4101/shop?ps=${order.payment_session_id}`);

    // Close button → onClose
    await page.getByRole('button', { name: 'Buy now' }).click();
    const overlay = page.getByRole('dialog', { name: 'OpenGateway checkout' });
    await expect(overlay).toBeVisible();
    const frame = page.frameLocator('iframe[title="OpenGateway checkout"]');
    await expect(frame.getByText(m.business_name).first()).toBeVisible();
    await page.getByRole('button', { name: 'Close checkout' }).click();
    await expect(overlay).toBeHidden();
    await expect.poll(() => page.evaluate(() => (window as any).__events)).toEqual([{ type: 'close' }]);

    // Pay inside the iframe
    await page.getByRole('button', { name: 'Buy now' }).click();
    await frame.getByRole('button', { name: 'Simulate success' }).click();
    await expect(frame.getByRole('heading', { name: 'Payment successful' })).toBeVisible();
    await expect(frame.getByText('Returning to merchant…')).toBeVisible();
    await expect(overlay).toBeHidden({ timeout: 15_000 });
    const events = await page.evaluate(() => (window as any).__events);
    const success = events[1];
    expect(success).toMatchObject({ type: 'success', order_id: order.id, status: 'paid' });
    expect(success.payment_id).toMatch(/^pay_/);
    expect(success.signature).toBe(hmac(m.key_secret, `${order.id}|${success.payment_id}`));
  });

  test('embed mode: a failed payment reports failure to the parent', async ({ page }) => {
    const { order } = await merchantWithOrder({ amount: 10100 });
    await page.goto(`http://127.0.0.1:4101/shop?ps=${order.payment_session_id}`);
    await page.getByRole('button', { name: 'Buy now' }).click();
    const frame = page.frameLocator('iframe[title="OpenGateway checkout"]');
    await frame.getByRole('button', { name: 'Simulate failure' }).click();
    await expect(frame.getByRole('heading', { name: 'Payment not verified' })).toBeVisible();
    await frame.getByRole('button', { name: 'Return to merchant' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__events)).toEqual([{ type: 'failure', order_id: order.id, status: expect.any(String) }]);
  });
});

export type { Merchant };
