import { test, expect, createMerchant, loginContext, toast } from './fixtures';

test.describe('Quick Collect', () => {
  test('keypad → QR → simulate → paid', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    await page.goto('/dashboard/quick-collect');
    const cta = page.getByRole('button', { name: /Show QR for|Enter an amount/ });
    await expect(cta).toBeDisabled();
    for (const k of ['1', '2', '3', '.', '5']) await page.getByRole('button', { name: k, exact: true }).click();
    await page.getByRole('button', { name: 'Delete digit' }).click();
    await page.getByRole('button', { name: '4', exact: true }).click();
    await expect(cta).toHaveText('Show QR for ₹123.40');
    await page.getByLabel(/Note/).fill('Table 4');
    await cta.click();

    await expect(page.getByRole('img', { name: 'UPI QR code' })).toBeVisible();
    await expect(page.getByText(m.vpa)).toBeVisible();
    await expect(page.getByText('Table 4')).toBeVisible();
    await expect(page.getByText(/\d\d:\d\d$/)).toBeVisible();
    await page.getByRole('button', { name: 'Full screen for customer' }).click();
    await page.getByRole('button', { name: 'Exit full screen' }).click();
    await page.getByRole('button', { name: 'Simulate payment' }).click();
    await expect(page.getByText('Payment received')).toBeVisible();
    await expect(page.getByText(/^UTR \d{12}$/)).toBeVisible();
    await page.getByRole('button', { name: 'New collection' }).click();
    await expect(cta).toHaveText('Enter an amount');
  });

  test('presets, cancel a collection and mark one paid by hand', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    await page.goto('/dashboard/quick-collect');
    await page.getByRole('button', { name: '₹500', exact: true }).click();
    await page.getByRole('button', { name: 'Show QR for ₹500.00' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('dialog', { name: /Cancel this collection/ }).getByRole('button', { name: 'Cancel collection' }).click();
    await expect(page.getByText('Collection cancelled')).toBeVisible();
    await page.getByRole('button', { name: 'New collection' }).click();

    await page.getByRole('button', { name: '₹100', exact: true }).click();
    await page.getByRole('button', { name: 'Show QR for ₹100.00' }).click();
    await page.getByRole('button', { name: 'Mark as paid' }).click();
    await page.getByRole('dialog', { name: 'Mark as paid' }).getByRole('button', { name: 'Mark as paid' }).click();
    await expect(toast(page, 'Order marked as paid')).toBeVisible();
    await expect(page.getByText('Payment received')).toBeVisible();
    await page.getByRole('link', { name: 'View order' }).click();
    await expect(page).toHaveURL(/\/dashboard\/orders\/order_/);
  });
});
