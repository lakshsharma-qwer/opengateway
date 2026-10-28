import { test, expect, createMerchant, loginContext, dash, toast, BASE_URL } from './fixtures';

test.describe('Payment links', () => {
  test('create, share drawer, pay through the short URL, link-status shows paid', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    await page.goto('/dashboard/payment-links');
    await expect(page.getByText('No payment links yet')).toBeVisible();
    await page.getByRole('button', { name: 'Create payment link' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Create payment link' });
    await dialog.getByRole('button', { name: 'Create link' }).click();
    await expect(dialog.getByText('Minimum amount is ₹1.00')).toBeVisible();
    await dialog.getByLabel('Amount').fill('249');
    await dialog.getByLabel(/Description/).fill('Diwali hamper');
    await dialog.getByLabel(/Reference ID/).fill('INV-77');
    await dialog.getByLabel(/^Name/).fill('Kabir');
    await dialog.getByLabel(/^Phone/).fill('9876501234');
    await dialog.getByLabel(/^Email/).fill('bad');
    await dialog.getByRole('button', { name: 'Create link' }).click();
    await expect(dialog.getByText('Enter a valid email')).toBeVisible();
    await dialog.getByLabel(/^Email/).fill('kabir@e2e.test');
    await dialog.getByRole('button', { name: 'Create link' }).click();
    await expect(toast(page, 'Payment link created')).toBeVisible();

    const drawer = page.getByRole('dialog', { name: 'Share payment link' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('₹249.00 · Diwali hamper')).toBeVisible();
    const shortUrl = (await drawer.locator('code').first().textContent())!.trim();
    expect(shortUrl).toMatch(new RegExp(`^${BASE_URL}/l/\\w+$`));
    await expect(drawer.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/919876501234\?text=/);
    await expect(drawer.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', shortUrl);
    await expect(drawer.getByRole('img', { name: 'UPI QR code' })).toBeVisible();
    await expect(drawer.getByText(`Hi Kabir, please pay ₹249.00 for Diwali hamper using this UPI link: ${shortUrl}`)).toBeVisible();
    await drawer.getByRole('button', { name: 'Copy message' }).click();
    await expect(drawer.getByRole('button', { name: 'Copied' })).toBeVisible();
    await drawer.getByRole('button', { name: 'Close' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first()).toContainText('Active');

    // Customer opens the short link → hosted checkout → simulate success.
    await page.goto(shortUrl);
    await expect(page).toHaveURL(/\/pay\/ps_/);
    await expect(page.getByText('Diwali hamper').first()).toBeVisible();
    await page.getByRole('button', { name: 'Simulate success' }).click();
    await expect(page.getByRole('heading', { name: 'Payment successful' })).toBeVisible();
    // The order's return_url sends the customer to the link-status page.
    await expect(page).toHaveURL(/\/link-status\/\w+/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'This link has been paid' })).toBeVisible();
    await expect(page.getByText('₹249.00')).toBeVisible();

    // Opening the short URL again lands on the status page too.
    await page.goto(shortUrl);
    await expect(page.getByRole('heading', { name: 'This link has been paid' })).toBeVisible();

    await page.goto('/dashboard/payment-links');
    const row = page.locator('tbody tr').first();
    await expect(row).toContainText('Paid');
    await row.getByRole('link', { name: 'View order' }).click();
    await expect(page).toHaveURL(/\/dashboard\/orders\/order_/);
    await expect(page.getByText('Payment link', { exact: true })).toBeVisible();
  });

  test('cancel a link → link-status shows cancelled', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    const link = await dash(m, 'POST', '/api/payment-links', { amount: 15000, description: 'Tailoring advance' });
    await page.goto('/dashboard/payment-links');
    const row = page.locator('tbody tr', { hasText: link.id });
    await row.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('dialog', { name: 'Share payment link' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Share payment link' })).toBeHidden();

    await row.getByRole('button', { name: 'Cancel link' }).click();
    await page.getByRole('dialog', { name: /Cancel this payment link/ }).getByRole('button', { name: 'Cancel link' }).click();
    await expect(toast(page, 'Payment link cancelled')).toBeVisible();
    await expect(row).toContainText('Cancelled');
    await page.getByRole('radio', { name: 'Cancelled' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);

    await page.goto(link.short_url);
    await expect(page).toHaveURL(/\/link-status\//);
    await expect(page.getByRole('heading', { name: 'This payment link was cancelled' })).toBeVisible();
    await expect(page.getByText('Tailoring advance')).toBeVisible();
  });

  test('unknown link code shows a friendly not-found page', async ({ page }) => {
    await page.goto('/link-status/doesnotexist');
    await expect(page.getByRole('heading', { name: 'Link not found' })).toBeVisible();
  });
});
