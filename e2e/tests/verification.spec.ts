import { test, expect, createMerchant, loginContext, v1, dash, toast, ingest, creditSms, randomUtr, apiContext } from './fixtures';

test.describe('Verification', () => {
  test('observer ingest URL → SMS marks the order paid and an open checkout updates live', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    await page.goto('/dashboard/verification?tab=observers');
    await expect(page.getByText('No SMS forwarders yet')).toBeVisible();
    await page.getByRole('button', { name: 'Add forwarder' }).first().click();
    const add = page.getByRole('dialog', { name: 'Add SMS forwarder' });
    await add.getByLabel('Name').fill('Counter phone');
    await add.getByRole('button', { name: 'Create' }).click();
    const reveal = page.getByRole('dialog', { name: /Connect “Counter phone”/ });
    const ingestUrl = (await reveal.locator('code').first().textContent())!.trim();
    expect(ingestUrl).toMatch(/\/v1\/observers\/ingest\?token=\S+$/);
    await reveal.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Counter phone')).toBeVisible();
    await expect(page.getByText('Never seen')).toBeVisible();

    // Customer has the checkout open in another tab.
    const order = await v1(m, m.api).createOrder({ amount: 49900, receipt: 'rcpt_sms' });
    const checkout = await context.newPage();
    await checkout.goto(new URL(order.checkout_url).pathname);
    await expect(checkout.getByText('Scan with any UPI app').or(checkout.getByText('Pay using a UPI app'))).toBeVisible();

    // The phone forwards the bank SMS.
    const utr = randomUtr();
    const res = await ingest(await apiContext(), ingestUrl, creditSms(order.amount_payable, utr));
    expect(res).toMatchObject({ ok: true, status: 'matched', order_id: order.id });

    await expect(checkout.getByRole('heading', { name: 'Payment successful' })).toBeVisible();
    await expect(checkout.getByText(utr)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/Last seen/)).toBeVisible();
    await page.goto(`/dashboard/orders/${order.id}`);
    await expect(page.getByText('Verified by observer')).toBeVisible();
    await expect(page.getByText(utr).first()).toBeVisible();
    await expect(page.getByText(/credited to a\/c XX4421/)).toBeVisible();

    // Rotate and delete the forwarder.
    await page.goto('/dashboard/verification?tab=observers');
    await page.getByRole('button', { name: /Rotate token|Get new URL/ }).click();
    await page.getByRole('dialog', { name: 'Rotate token?' }).getByRole('button', { name: 'Rotate token' }).click();
    const rotated = page.getByRole('dialog', { name: /Connect “Counter phone”/ });
    const newUrl = (await rotated.locator('code').first().textContent())!.trim();
    expect(newUrl).not.toBe(ingestUrl);
    await rotated.getByRole('button', { name: 'Done' }).click();
    const old = await (await apiContext()).post(new URL(ingestUrl).pathname + new URL(ingestUrl).search, { data: { text: 'hello' } });
    expect(old.status()).toBe(401);
    await page.getByRole('button', { name: 'Delete Counter phone' }).click();
    await page.getByRole('dialog', { name: /Delete “Counter phone”/ }).getByRole('button', { name: 'Delete forwarder' }).click();
    await expect(toast(page, 'Forwarder deleted')).toBeVisible();
    await expect(page.getByText('No SMS forwarders yet')).toBeVisible();
  });

  test('unmatched credit → attach to an order; ignore another', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    const obs = await dash(m, 'POST', '/api/observers', { name: 'Shop phone', mode: 'test' });
    const order = await v1(m, m.api).createOrder({ amount: 30000, receipt: 'rcpt_attach' });
    const api = await apiContext();
    // An amount that matches no open order.
    const u1 = randomUtr();
    const r1 = await ingest(api, obs.ingest_url, creditSms(29999, u1));
    expect(r1.status).toBe('unmatched');
    const r2 = await ingest(api, obs.ingest_url, creditSms(12345, randomUtr()));
    expect(r2.status).toBe('unmatched');

    await page.goto('/dashboard/verification');
    await expect(page.getByRole('tab', { name: /Bank credits\s*2/ })).toBeVisible();
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(2);
    const row1 = rows.filter({ hasText: u1 });
    await row1.getByRole('button', { name: 'Attach' }).click();
    const dialog = page.getByRole('dialog', { name: 'Attach credit to an order' });
    const attachBtn = dialog.getByRole('button', { name: 'Attach and mark paid' });
    await expect(attachBtn).toBeDisabled();
    await dialog.getByLabel('Search orders').fill(order.id.slice('order_'.length));
    await expect(dialog.getByRole('radio')).toHaveCount(1);
    await dialog.getByRole('radio').first().check();
    await attachBtn.click();
    await expect(toast(page, 'Credit attached')).toBeVisible();
    await expect(rows).toHaveCount(1);

    await rows.first().getByRole('button', { name: 'Ignore credit' }).click();
    await page.getByRole('dialog', { name: 'Ignore this credit?' }).getByRole('button', { name: 'Ignore credit' }).click();
    await expect(toast(page, 'Credit ignored')).toBeVisible();
    await expect(page.getByText('All bank credits are matched')).toBeVisible();

    await page.getByRole('radio', { name: 'Ignored' }).click();
    await expect(rows).toHaveCount(1);
    await page.getByRole('radio', { name: 'Matched', exact: true }).click();
    await expect(rows).toHaveCount(1);
    await rows.first().getByRole('link', { name: order.id }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/orders/${order.id}$`));
    await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
  });

  test('parse playground', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    await page.goto('/dashboard/verification');
    await page.getByRole('tab', { name: 'Parse playground' }).click();
    await expect(page).toHaveURL(/tab=playground/);
    await page.getByRole('button', { name: 'SBI sample' }).click();
    await page.getByRole('button', { name: 'Parse message' }).click();
    await expect(page.getByText('credit', { exact: true })).toBeVisible();
    await expect(page.getByText('₹1,250.00', { exact: true })).toBeVisible();
    await expect(page.getByText('430912345678', { exact: true })).toBeVisible();
    await expect(page.getByText('rahul@ybl', { exact: true })).toBeVisible();

    await page.getByLabel('SMS or notification text').fill('Rs.500.00 debited from a/c XX12 to VPA shop@ybl. UPI Ref 123456789012');
    await page.getByRole('button', { name: 'Parse message' }).click();
    await expect(page.getByText('debit', { exact: true })).toBeVisible();
    await expect(page.getByText('This message would be ignored')).toBeVisible();

    await page.getByLabel('SMS or notification text').fill('');
    await expect(page.getByRole('button', { name: 'Parse message' })).toBeDisabled();
  });
});
