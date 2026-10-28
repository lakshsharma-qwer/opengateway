import { test, expect, createMerchant, loginContext, v1, checkoutApi, paidOrder, dash, toast, randomUtr, type Merchant } from './fixtures';

async function setup(context: import('@playwright/test').BrowserContext) {
  const m = await createMerchant();
  await loginContext(context, m);
  return m;
}

test.describe('Orders', () => {
  test('filters, search and pagination', async ({ page, context }) => {
    const m = await setup(context);
    const api = v1(m, m.api);
    // 26 open orders + 1 paid + 1 cancelled = 28 → two pages of 25.
    for (let i = 0; i < 26; i++) await api.createOrder({ amount: 10000 + i * 100, receipt: `open-${i}` });
    const paid = await paidOrder(m, { amount: 77700, receipt: 'rcpt_paid_one' });
    const cancelled = await api.createOrder({ amount: 88800, receipt: 'rcpt_cancel_one' });
    await dash(m, 'POST', `/api/orders/${cancelled.id}/cancel`);

    await page.goto('/dashboard/orders');
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(25);
    await expect(page.getByText('Showing 1–25')).toBeVisible();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/skip=25/);
    await expect(rows).toHaveCount(3);
    await expect(page.getByText('Showing 26–28')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(rows).toHaveCount(25);

    await page.getByRole('radio', { name: 'Paid' }).click();
    await expect(page).toHaveURL(/status=paid/);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(paid.id);
    await expect(rows.first()).toContainText('Paid');

    await page.getByRole('radio', { name: 'Cancelled' }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(cancelled.id);

    await page.getByRole('radio', { name: 'All' }).click();
    await page.getByRole('searchbox').fill('open-7');
    await expect(page).toHaveURL(/q=open-7/);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('open-7');
    // Search by the random part of an order ID. (Full IDs containing "_" don't match: server bug, see report.)
    await page.getByRole('searchbox').fill(paid.id.slice('order_'.length));
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(paid.id);

    await page.getByRole('searchbox').fill('no-such-order-anywhere');
    await expect(page.getByText('No orders match these filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expect(rows).toHaveCount(25);

    // Date range filter: tomorrow onwards → nothing.
    const t = new Date(Date.now() + 86400000);
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    await page.getByLabel('From date').fill(iso);
    await expect(page.getByText('No orders match these filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(rows).toHaveCount(25);
  });

  test('create an order from the dashboard and open its detail page', async ({ page, context }) => {
    await setup(context);
    await page.goto('/dashboard/orders');
    await expect(page.getByText('No orders yet')).toBeVisible();
    await page.getByRole('button', { name: 'Create order' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Create order' });
    await dialog.getByRole('button', { name: 'Create order' }).click();
    await expect(dialog.getByText('Minimum amount is ₹1.00')).toBeVisible();
    await dialog.getByLabel('Amount').fill('349.50');
    await dialog.getByLabel(/Description/).fill('Two filter coffees');
    await dialog.getByLabel(/Customer name/).fill('Neha');
    await dialog.getByLabel('Expires in').selectOption('3600');
    await dialog.getByRole('button', { name: 'Create order' }).click();
    await expect(toast(page, 'Order created')).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/orders\/order_/);
    await expect(page.getByText('₹349.50').first()).toBeVisible();
    await expect(page.getByText('Created', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Neha')).toBeVisible();
    await page.getByRole('link', { name: 'Orders' }).first().click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });

  test('mark paid with a UTR (validated) and copy the checkout link', async ({ page, context }) => {
    const m = await setup(context);
    const o = await v1(m, m.api).createOrder({ amount: 129900, receipt: 'rcpt_mark' });
    await page.goto(`/dashboard/orders/${o.id}`);
    await expect(page.getByText(o.id).first()).toBeVisible();

    await page.getByRole('button', { name: 'Copy checkout link' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(o.checkout_url);
    await expect(page.getByRole('link', { name: 'Open checkout' })).toHaveAttribute('href', o.checkout_url);

    await page.getByRole('button', { name: 'Mark as paid' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mark as paid' });
    await dialog.getByLabel(/UTR/).fill('12345');
    await dialog.getByRole('button', { name: 'Mark as paid' }).click();
    await expect(dialog.getByText('UTR must be 12 digits')).toBeVisible();
    const utr = randomUtr();
    await dialog.getByLabel(/UTR/).fill(utr);
    await dialog.getByLabel(/Note/).fill('Seen in HDFC app');
    await dialog.getByRole('button', { name: 'Mark as paid' }).click();
    await expect(toast(page, 'Order marked as paid')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(utr).first()).toBeVisible();
    await expect(page.getByText('Verified by merchant')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark as paid' })).toBeHidden();
    await expect(page.getByText('marked_paid_note:')).toBeVisible();
  });

  test('cancel an open order', async ({ page, context }) => {
    const m = await setup(context);
    const o = await v1(m, m.api).createOrder({ amount: 20000 });
    await page.goto(`/dashboard/orders/${o.id}`);
    await page.getByRole('button', { name: 'Cancel order' }).click();
    const dialog = page.getByRole('dialog', { name: /Cancel this order/ });
    await dialog.getByRole('button', { name: 'Keep it' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Cancel order' }).click();
    await dialog.getByRole('button', { name: 'Cancel order' }).click();
    await expect(toast(page, 'Order cancelled')).toBeVisible();
    await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel order' })).toBeHidden();
    await expect(page.getByText('Order cancelled', { exact: true }).last()).toBeVisible(); // timeline

    // A late credit: the merchant can still mark a cancelled order paid.
    await page.getByRole('button', { name: 'Mark as paid' }).click();
    const late = page.getByRole('dialog', { name: 'Mark as paid' });
    await expect(late).toContainText('records a late payment');
    await late.getByRole('button', { name: 'Mark as paid' }).click();
    await expect(toast(page, 'Order marked as paid')).toBeVisible();
    await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
  });

  test('reject a payment that is pending verification', async ({ page, context }) => {
    const m = await setup(context);
    const o = await v1(m, m.api).createOrder({ amount: 45000 });
    const c = checkoutApi(m.api, o.payment_session_id);
    await c.attempt('intent', 'phonepe');
    const utr = randomUtr();
    await c.confirm(utr);

    await page.goto(`/dashboard/orders/${o.id}`);
    const banner = page.getByText('The customer says they paid');
    await expect(banner).toContainText(utr);
    await page.getByRole('button', { name: 'Reject' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reject this payment?' });
    await dialog.getByLabel('Reason').selectOption('other');
    await dialog.getByLabel('Describe the reason').fill('No credit in bank statement');
    await dialog.getByRole('button', { name: 'Reject payment' }).click();
    await expect(toast(page, 'Payment rejected')).toBeVisible();
    await expect(banner).toBeHidden();
    await expect(page.getByText(/MERCHANT_REJECTED/)).toBeVisible();
    await expect(page.getByText('Failed', { exact: true }).first()).toBeVisible();
    // The order reopens so the customer can try again.
    await expect(page.getByRole('button', { name: 'Mark as paid' })).toBeVisible();
  });

  test('refund: over-limit errors are shown inline, then refund and process', async ({ page, context }) => {
    const m = await setup(context);
    const o = await paidOrder(m, { amount: 100000 });
    await page.goto(`/dashboard/orders/${o.id}`);
    await page.getByRole('button', { name: 'Issue refund' }).click();
    const dialog = page.getByRole('dialog', { name: 'Issue refund' });
    const amount = dialog.getByLabel('Refund amount');
    await expect(amount).toHaveValue('1000');
    await expect(dialog.getByRole('button', { name: 'Issue full refund' })).toBeVisible();
    await amount.fill('1500');
    await dialog.getByRole('button', { name: 'Issue refund' }).click();
    await expect(dialog.getByText('You can refund up to ₹1,000.00')).toBeVisible();
    await amount.fill('250');
    await dialog.getByLabel(/Reason/).fill('One item out of stock');
    await dialog.getByRole('button', { name: 'Issue refund' }).click();
    await expect(toast(page, 'Refund created')).toBeVisible();
    await expect(page.getByText('₹250.00').first()).toBeVisible();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();

    // Server-side limit: try to refund more than what's left through the Refunds page.
    const pay = (await dash(m, 'GET', `/api/orders/${o.id}`)).payments[0];
    await page.goto('/dashboard/refunds');
    await page.getByRole('button', { name: 'Create refund' }).click();
    const create = page.getByRole('dialog', { name: 'Issue refund' });
    await create.getByLabel('Payment ID').fill(pay.id);
    await create.getByLabel('Refund amount').fill('900');
    await create.getByRole('button', { name: 'Issue refund' }).click();
    await expect(create.getByText(/exceed|more than|refundable/i)).toBeVisible();
    await expect(create).toBeVisible();
    await create.getByRole('button', { name: 'Cancel' }).click();

    // Process the pending refund from the order page.
    await page.goto(`/dashboard/orders/${o.id}`);
    await page.getByRole('button', { name: 'Mark processed' }).click();
    const proc = page.getByRole('dialog', { name: 'Mark refund processed' });
    const rutr = randomUtr();
    await proc.getByLabel(/Refund UTR/).fill(rutr);
    await proc.getByRole('button', { name: 'Mark processed' }).click();
    await expect(toast(page, 'Refund marked processed')).toBeVisible();
    await expect(page.getByText('Processed', { exact: true })).toBeVisible();
    await expect(page.getByText(rutr)).toBeVisible();
  });
});
