import { test, expect, seedMerchant, loginContext, createMerchant, v1, expectNoHorizontalScroll } from './fixtures';

const DASHBOARD = [
  '/dashboard',
  '/dashboard/orders',
  '/dashboard/payments',
  '/dashboard/refunds',
  '/dashboard/payment-links',
  '/dashboard/quick-collect',
  '/dashboard/verification',
  '/dashboard/verification?tab=observers',
  '/dashboard/verification?tab=playground',
  '/dashboard/reports',
  '/dashboard/developers/api-keys',
  '/dashboard/developers/webhooks',
  '/dashboard/developers/events',
  '/dashboard/developers/logs',
  '/dashboard/settings/business',
  '/dashboard/settings/upi',
  '/dashboard/settings/checkout',
  '/dashboard/settings/team',
  '/dashboard/settings/security',
];

test.describe('Responsiveness at 360px', () => {
  test.use({ viewport: { width: 360, height: 760 } });

  test('public pages', async ({ page }) => {
    for (const path of ['/', '/login', '/signup', '/docs', '/link-status/nope']) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  });

  test('checkout (pay, confirm and terminal views)', async ({ page }) => {
    const m = await createMerchant();
    const o = await v1(m, m.api).createOrder({ amount: 1234500, receipt: 'rcpt-a-long-receipt-identifier-00000001' });
    await page.goto(new URL(o.checkout_url).pathname);
    await expect(page.getByRole('button', { name: 'I have paid' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Show QR to scan from another phone' }).or(page.getByRole('heading', { name: 'Scan with any UPI app' })).first().click();
    await expect(page.getByRole('img', { name: 'UPI QR code' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'I have paid' }).click();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Simulate success' }).click();
    await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('every dashboard page', async ({ page, context }) => {
    test.setTimeout(120_000);
    const m = await seedMerchant();
    await loginContext(context, m);
    for (const path of DASHBOARD) {
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalScroll(page);
    }
    // An order detail page with long IDs
    await page.goto('/dashboard/orders');
    await page.locator('tbody tr').first().locator('td').nth(1).click();
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    // Mobile navigation drawer
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('link', { name: 'Payments' }).click();
    await expect(page).toHaveURL(/\/dashboard\/payments$/);
    await expect(page.getByRole('button', { name: 'Close menu' })).toBeHidden();
  });
});
