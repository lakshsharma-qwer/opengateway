import { test, expect, seedMerchant, createMerchant, loginContext, toast, dash } from './fixtures';

test.describe('Dashboard home', () => {
  test('renders KPIs, charts and recent orders from seeded data; range switch refetches', async ({ page, context }) => {
    await loginContext(context, await seedMerchant());
    const first = page.waitForResponse((r) => r.url().includes('/api/dashboard/summary') && r.url().includes('range=7d'));
    await page.goto('/dashboard');
    await first;
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Demo');
    await expect(page.getByText(/^\s*Test mode/)).toBeVisible();

    for (const label of ['Collected', 'Orders', 'Success rate', 'Avg. ticket', 'Pending verification', 'Unmatched credits']) {
      await expect(page.getByRole('main').getByText(label, { exact: true }).first()).toBeVisible();
    }
    // Two seeded unmatched credits and one pending verification.
    await expect(page.getByRole('link', { name: /Unmatched credits\s*2/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pending verification\s*1/ })).toBeVisible();

    // Switch to 90 days: all seeded data is in range, so both charts render.
    const ninety = page.waitForResponse((r) => r.url().includes('range=90d') && r.ok());
    await page.getByRole('radio', { name: '90 days' }).click();
    await ninety;
    await expect(page.getByRole('radio', { name: '90 days' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.recharts-area-area')).toBeVisible();
    await expect(page.locator('.recharts-pie-sector').first()).toBeVisible();
    await expect(page.getByText(/^₹[\d,]+\.\d\d$/).first()).toBeVisible();

    // Recent orders table → order detail
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toContainText(/order_/);
    await firstRow.locator('td').nth(1).click();
    await expect(page).toHaveURL(/\/dashboard\/orders\/order_/);

    // KPI links
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /Unmatched credits/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/verification$/);
  });

  test('Live toggle shows the activation card and empty live data', async ({ page, context }) => {
    await loginContext(context, await seedMerchant());
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Activate live mode' })).toBeVisible();
    await page.getByRole('radio', { name: 'Live' }).click();
    await expect(page.getByRole('radio', { name: 'Live' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText(/^\s*Test mode/)).toBeHidden();
    await expect(page.getByText("Live mode isn't activated yet")).toBeVisible();
    await expect(page.getByText('No orders yet')).toBeVisible();
    await expect(page.getByText('No collections in this period')).toBeVisible();

    // Activating without a live UPI ID explains what's missing.
    await page.getByRole('button', { name: 'Activate', exact: true }).click();
    await expect(toast(page, /live UPI ID/i)).toBeVisible();

    // The choice survives a reload, and switching back restores test data.
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Live' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'Test' }).click();
    await expect(page.getByText(/^\s*Test mode/)).toBeVisible();
    await expect(page.locator('tbody tr').first()).toContainText(/order_/);
  });

  test('activating live mode end to end', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Add live UPI ID' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/settings\/upi$/);
    await expect(page.getByRole('radio', { name: 'Live' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('No live UPI IDs')).toBeVisible();
    await page.getByRole('button', { name: 'Add UPI ID' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add live UPI ID' });
    await dialog.getByLabel('UPI ID (VPA)').fill(`live${Date.now()}@okicici`);
    await dialog.getByLabel('Payee name').fill(m.business_name);
    await dialog.getByRole('button', { name: 'Add UPI ID' }).click();
    await expect(toast(page, 'UPI ID added')).toBeVisible();

    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Activate', exact: true }).click();
    await expect(toast(page, 'Live mode activated')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activate live mode' })).toBeHidden();
    await expect(page.getByText("Live mode isn't activated yet")).toBeHidden();
    const me = await dash(m, 'GET', '/api/auth/me');
    expect(me.merchant.live_enabled).toBe(true);
  });
});
