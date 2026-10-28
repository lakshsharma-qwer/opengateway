import { test, expect, createMerchant, loginContext, v1, paidOrder, toast, seedCreds, apiContext } from './fixtures';

const basic = (id: string, secret: string) => 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');

test.describe('Developers', () => {
  test('generate and revoke API keys; old keys stop working on /v1', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    const api = await apiContext();
    const call = (id: string, s: string) => api.get('/v1/orders', { headers: { Authorization: basic(id, s) } });
    expect((await call(m.key_id, m.key_secret)).status()).toBe(200);

    await page.goto('/dashboard/developers/api-keys');
    const oldRow = page.locator('tbody tr', { hasText: m.key_id });
    await expect(oldRow).toContainText('Active');
    await page.getByRole('button', { name: 'Generate test key' }).click();
    const confirm = page.getByRole('dialog', { name: 'Generate a new key?' });
    await expect(confirm).toContainText(m.key_id);
    await confirm.getByRole('button', { name: 'Generate and deactivate old key' }).click();
    const reveal = page.getByRole('dialog', { name: /New test API key/ });
    const codes = reveal.locator('code');
    const newId = (await codes.nth(0).textContent())!.trim();
    const newSecret = (await codes.nth(1).textContent())!.trim();
    expect(newId).toMatch(/^og_test_/);
    await reveal.getByRole('button', { name: "I've saved it" }).click();
    await expect(oldRow).toContainText('Revoked');
    await expect(page.locator('tbody tr', { hasText: newId })).toContainText('Active');

    expect((await call(m.key_id, m.key_secret)).status()).toBe(401);
    expect((await call(newId, newSecret)).status()).toBe(200);

    await page.locator('tbody tr', { hasText: newId }).getByRole('button', { name: 'Revoke' }).click();
    await page.getByRole('dialog', { name: 'Revoke this key?' }).getByRole('button', { name: 'Revoke key' }).click();
    await expect(toast(page, 'Key revoked')).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: newId })).toContainText('Revoked');
    expect((await call(newId, newSecret)).status()).toBe(401);

    // With no active key, "Generate" skips the confirmation.
    await page.getByRole('button', { name: 'Generate test key' }).click();
    await expect(page.getByRole('dialog', { name: /New test API key/ })).toBeVisible();
  });

  test('webhooks: create, send test, deliveries, resend, edit, delete', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    const hookUrl = `${seedCreds().hook_url}/e2e-${Date.now()}`;
    await page.goto('/dashboard/developers/webhooks');
    await expect(page.getByText('No webhook endpoints')).toBeVisible();
    await page.getByRole('button', { name: 'Add endpoint' }).first().click();
    const modal = page.getByRole('dialog', { name: 'Add webhook endpoint' });
    await modal.getByLabel('Endpoint URL').fill('not a url');
    await modal.getByRole('button', { name: 'Add endpoint' }).click();
    await expect(modal.getByText(/Enter a full URL/)).toBeVisible();
    await modal.getByLabel('Endpoint URL').fill(hookUrl);
    await modal.getByLabel(/Description/).fill('Order sync');
    await modal.getByLabel('order.expired').check();
    await modal.getByRole('button', { name: 'Add endpoint' }).click();
    const secret = page.getByRole('dialog', { name: /Endpoint created/ });
    await expect(secret.locator('code')).toHaveText(/\S{16,}/);
    await secret.getByRole('button', { name: 'Done' }).click();

    const card = page.locator('div.rounded-2xl', { hasText: hookUrl }).first();
    await expect(card).toContainText('Order sync');
    await expect(card).toContainText('order.expired');

    await card.getByRole('button', { name: 'Send test' }).click();
    await expect(toast(page, 'Test ping sent')).toBeVisible();

    await card.getByRole('button', { name: 'Secret' }).click();
    await expect(page.getByRole('dialog', { name: 'Signing secret' }).locator('code')).toHaveText(/\S{16,}/);
    await page.getByRole('dialog', { name: 'Signing secret' }).getByRole('button', { name: 'Done' }).click();

    await card.getByRole('button', { name: 'Deliveries' }).click();
    const drawer = page.getByRole('dialog', { name: 'Deliveries' });
    const item = drawer.getByRole('button', { name: /ping/ }).first();
    await expect(async () => {
      await drawer.getByRole('button', { name: 'Refresh' }).click();
      await expect(item).toContainText('Success', { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(item).toContainText('HTTP 200');
    await item.click();
    await expect(item).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByText('{"ok":true}')).toBeVisible();
    await drawer.getByRole('button', { name: 'Resend' }).click();
    await expect(toast(page, 'Delivery queued again')).toBeVisible();
    await drawer.getByRole('button', { name: 'Close' }).click();

    await card.getByRole('button', { name: 'Edit endpoint' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit webhook endpoint' });
    await expect(edit.getByLabel('Endpoint URL')).toHaveValue(hookUrl);
    await edit.getByLabel(/Description/).fill('Order sync v2');
    await edit.getByLabel('All events').check();
    await edit.getByRole('switch').click();
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(toast(page, 'Endpoint updated')).toBeVisible();
    await expect(card).toContainText('Order sync v2');
    await expect(card).toContainText('All events');
    await expect(card).toContainText('Inactive');

    await card.getByRole('button', { name: 'Delete endpoint' }).click();
    await page.getByRole('dialog', { name: 'Delete this endpoint?' }).getByRole('button', { name: 'Delete endpoint' }).click();
    await expect(toast(page, 'Endpoint deleted')).toBeVisible();
    await expect(page.getByText('No webhook endpoints')).toBeVisible();
  });

  test('events and API logs show entries', async ({ page, context, isMobile }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    const o = await paidOrder(m, { amount: 12300 });
    await v1(m, m.api).raw('GET', `/v1/orders/${o.id}`);
    await v1(m, m.api).raw('GET', '/v1/orders/order_doesnotexist0');

    await page.goto('/dashboard/developers/events');
    const rows = page.locator('tbody tr');
    await expect(rows.filter({ hasText: 'order.paid' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'payment.captured' })).toHaveCount(1);
    await page.getByLabel('Event type').selectOption('order.paid');
    await expect(rows).toHaveCount(1);
    await rows.first().locator('td').first().click();
    const drawer = page.getByRole('dialog', { name: 'order.paid' });
    await expect(drawer.locator('pre')).toContainText(o.id);
    await drawer.getByRole('button', { name: 'Close' }).click();
    if (!isMobile) {
      // The Order column is hidden on small screens.
      await rows.first().getByRole('link', { name: o.id }).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/orders/${o.id}$`));
    }

    await page.goto('/dashboard/developers/logs');
    const logs = page.locator('tbody tr');
    await expect(logs.filter({ hasText: 'POST' }).filter({ hasText: '/v1/orders' }).first()).toContainText('201');
    await page.getByRole('radio', { name: '4xx' }).click();
    await expect(logs).toHaveCount(1);
    await expect(logs.first()).toContainText('404');
    await page.getByRole('radio', { name: '2xx' }).click();
    await expect(logs.first()).toContainText('200');
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(logs.first()).toBeVisible();
  });
});
