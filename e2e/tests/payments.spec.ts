import { test, expect, createMerchant, loginContext, v1, checkoutApi, paidOrder, dash, toast, randomUtr } from './fixtures';

test.describe('Payments and refunds', () => {
  test('payments list: filter, search and open the order', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    const captured = await paidOrder(m, { amount: 31400 });
    const pending = await v1(m, m.api).createOrder({ amount: 27100 });
    const c = checkoutApi(m.api, pending.payment_session_id);
    await c.attempt('qr');
    const utr = randomUtr();
    await c.confirm(utr);

    await page.goto('/dashboard/payments');
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await page.getByRole('radio', { name: 'Verifying' }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(utr);
    await expect(rows.first()).toContainText('Verifying');
    await page.getByRole('radio', { name: 'Captured' }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Captured');
    await page.getByRole('radio', { name: 'All' }).click();
    await page.getByRole('searchbox').fill(utr);
    await expect(rows).toHaveCount(1);
    await rows.first().locator('td').nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/orders/${pending.id}$`));

    // KPI deep link from home lands on the filtered list.
    await page.goto('/dashboard/payments?status=pending_verification');
    await expect(page.getByRole('radio', { name: 'Verifying' })).toHaveAttribute('aria-checked', 'true');
    expect(captured.id).toBeTruthy();
  });

  test('refunds list: mark processed and mark failed', async ({ page, context, isMobile }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    const a = await paidOrder(m, { amount: 60000 });
    const b = await paidOrder(m, { amount: 70000 });
    const payA = (await dash(m, 'GET', `/api/orders/${a.id}`)).payments[0];
    const payB = (await dash(m, 'GET', `/api/orders/${b.id}`)).payments[0];
    const rA = await dash(m, 'POST', '/api/refunds', { payment_id: payA.id, amount: 10000 });
    const rB = await dash(m, 'POST', '/api/refunds', { payment_id: payB.id, amount: 20000 });

    await page.goto('/dashboard/refunds');
    const rowA = page.locator('tbody tr', { hasText: rA.id });
    const rowB = page.locator('tbody tr', { hasText: rB.id });
    await expect(rowA).toContainText('Pending');

    await rowA.getByRole('button', { name: 'Mark processed' }).click();
    const proc = page.getByRole('dialog', { name: 'Mark refund processed' });
    await proc.getByLabel(/Refund UTR/).fill('123');
    await proc.getByRole('button', { name: 'Mark processed' }).click();
    await expect(proc.getByText('UTR must be 12 digits')).toBeVisible();
    const utr = randomUtr();
    await proc.getByLabel(/Refund UTR/).fill(utr);
    await proc.getByRole('button', { name: 'Mark processed' }).click();
    await expect(toast(page, 'Refund marked processed')).toBeVisible();
    await expect(rowA).toContainText('Processed');
    await expect(rowA.getByRole('button', { name: 'Mark processed' })).toBeHidden();

    await rowB.getByRole('button', { name: 'Mark failed' }).click();
    await page.getByRole('dialog', { name: /Mark refund as failed/ }).getByRole('button', { name: 'Mark failed' }).click();
    await expect(toast(page, 'Refund marked failed')).toBeVisible();
    await expect(rowB).toContainText('Failed');

    await page.getByRole('radio', { name: 'Processed' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first()).toContainText(rA.id);
    // Order link in the list
    if (!isMobile) {
      await page.locator('tbody tr').first().getByRole('link', { name: a.id }).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/orders/${a.id}$`));
    }
  });
});
