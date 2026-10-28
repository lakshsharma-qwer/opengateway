import { test, expect, createMerchant, loginContext, v1, dash, toast, apiContext, BASE_URL, uid, randomIp, prepareContext } from './fixtures';

test.describe('Settings', () => {
  test('business profile: validate and save', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    await page.goto('/dashboard/settings/business');
    await expect(page.getByLabel('Business name')).toHaveValue(m.business_name);
    await page.getByLabel('Business name').fill('');
    await page.getByLabel('Website').fill('example.com');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Business name is required')).toBeVisible();
    await expect(page.getByText('Start with https://')).toBeVisible();

    await page.getByLabel('Business name').fill('Masala Mornings');
    await page.getByLabel('Business type').selectOption('partnership');
    await page.getByLabel('Website').fill('https://masala.example');
    await page.getByLabel('Support phone').fill('9800011122');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(toast(page, 'Business profile saved')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Business name')).toHaveValue('Masala Mornings');
    await expect(page.getByLabel('Business type')).toHaveValue('partnership');
    await expect(page.getByLabel('Website')).toHaveValue('https://masala.example');
    // The header shows the new name (desktop only shows it next to the avatar).
    const s = await dash(m, 'GET', '/api/settings');
    expect(s.business_name).toBe('Masala Mornings');
  });

  test('UPI accounts: add (with VPA validation), set default, edit, deactivate, remove', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    await page.goto('/dashboard/settings/upi');
    const first = page.locator('li', { hasText: m.vpa });
    await expect(first).toContainText('Default');

    await page.getByRole('button', { name: 'Add UPI ID' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add test UPI ID' });
    await dialog.getByLabel('UPI ID (VPA)').fill('bad vpa@@x');
    await dialog.getByLabel('Payee name').fill('Second Counter');
    await dialog.getByRole('button', { name: 'Add UPI ID' }).click();
    await expect(dialog.getByText('Enter a UPI ID like shop@okhdfcbank')).toBeVisible();
    const second = `counter${uid()}@ybl`;
    await dialog.getByLabel('UPI ID (VPA)').fill(second);
    await dialog.getByLabel(/Label/).fill('Counter');
    await dialog.getByRole('button', { name: 'Add UPI ID' }).click();
    await expect(toast(page, 'UPI ID added')).toBeVisible();

    // Duplicate VPA is rejected by the server and shown on the field.
    await page.getByRole('button', { name: 'Add UPI ID' }).click();
    await dialog.getByLabel('UPI ID (VPA)').fill(second);
    await dialog.getByLabel('Payee name').fill('Dup');
    await dialog.getByRole('button', { name: 'Add UPI ID' }).click();
    await expect(dialog.getByText(/already added/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    const row2 = page.locator('li', { hasText: second });
    await expect(row2).toContainText('Second Counter · Counter');
    await row2.getByRole('button', { name: 'Set default' }).click();
    await expect(toast(page, 'Default UPI ID updated')).toBeVisible();
    await expect(row2).toContainText('Default');
    await expect(first).not.toContainText('Default');

    // New orders now use the new default VPA.
    const o = await v1(m, m.api).createOrder({ amount: 10000 });
    expect(o.vpa).toBe(second);

    await row2.getByRole('button', { name: `Edit ${second}` }).click();
    const edit = page.getByRole('dialog', { name: 'Edit UPI ID' });
    await expect(edit.getByLabel('UPI ID (VPA)')).toBeDisabled();
    await edit.getByLabel('Payee name').fill('Counter Two');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(toast(page, 'UPI ID updated')).toBeVisible();
    await expect(row2).toContainText('Counter Two');

    await first.getByRole('switch').click();
    await expect(toast(page, 'UPI ID deactivated')).toBeVisible();
    await expect(first).toContainText('Inactive');
    await first.getByRole('switch').click();
    await expect(toast(page, 'UPI ID activated')).toBeVisible();

    await first.getByRole('button', { name: `Delete ${m.vpa}` }).click();
    await page.getByRole('dialog', { name: `Remove ${m.vpa}?` }).getByRole('button', { name: 'Remove UPI ID' }).click();
    await expect(toast(page, 'UPI ID removed')).toBeVisible();
    await expect(page.locator('li', { hasText: m.vpa })).toHaveCount(0);
  });

  test('branding colour and logo are reflected on the checkout', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    await page.goto('/dashboard/settings/checkout');
    const hex = page.getByLabel('Brand colour', { exact: true });
    await hex.fill('#12');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Use a 6-digit hex like #5f259f')).toBeVisible();
    await page.getByRole('button', { name: 'Use #0b8a5f' }).click();
    await expect(hex).toHaveValue('#0b8a5f');
    await page.getByLabel(/Logo URL/).fill('ftp://nope');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Use a full https:// image URL')).toBeVisible();
    const logo = `${BASE_URL}/favicon.svg`;
    await page.getByLabel(/Logo URL/).fill(logo);
    await page.getByLabel('Default order expiry').selectOption('600');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(toast(page, 'Checkout settings saved')).toBeVisible();

    const o = await v1(m, m.api).createOrder({ amount: 25000 });
    expect(o.expires_at - o.created_at).toBe(600);
    await page.goto(new URL(o.checkout_url).pathname);
    const pay = page.getByRole('button', { name: 'I have paid' });
    await expect(pay).toHaveCSS('background-color', 'rgb(11, 138, 95)');
    await expect(page.locator(`img[src="${logo}"]`)).toBeVisible();

    // Back to default restores the purple.
    await page.goto('/dashboard/settings/checkout');
    await page.getByRole('button', { name: 'Back to default' }).click();
    await expect(hex).toHaveValue('#5f259f');
  });

  test('team: invite, change role, remove; viewer cannot mutate', async ({ page, context, browser }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    await page.goto('/dashboard/settings/team');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first()).toContainText('(you)');

    const viewerEmail = `viewer_${uid()}@e2e.test`;
    await page.getByRole('button', { name: 'Add member' }).click();
    const invite = page.getByRole('dialog', { name: 'Add team member' });
    await invite.getByRole('button', { name: 'Add member' }).click();
    await expect(invite.getByText('Enter their name')).toBeVisible();
    await invite.getByLabel('Name').fill('Vik Viewer');
    await invite.getByLabel('Email').fill(viewerEmail);
    await invite.getByLabel('Role').selectOption('viewer');
    await invite.getByLabel('Temporary password').fill('viewer-pass-1');
    await invite.getByRole('button', { name: 'Add member' }).click();
    await expect(toast(page, 'Vik Viewer added')).toBeVisible();

    const devEmail = `dev_${uid()}@e2e.test`;
    await page.getByRole('button', { name: 'Add member' }).click();
    await invite.getByLabel('Name').fill('Dev Desai');
    await invite.getByLabel('Email').fill(devEmail);
    await invite.getByLabel('Temporary password').fill('dev-pass-123');
    await invite.getByRole('button', { name: 'Add member' }).click();
    await expect(toast(page, 'Dev Desai added')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(3);

    await page.getByLabel('Role for Dev Desai').selectOption('admin');
    await expect(toast(page, 'Dev Desai is now admin')).toBeVisible();
    await page.getByRole('button', { name: 'Remove Dev Desai' }).click();
    await page.getByRole('dialog', { name: 'Remove Dev Desai?' }).getByRole('button', { name: 'Remove member' }).click();
    await expect(toast(page, 'Member removed')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(2);

    // Something for the viewer to look at.
    const order = await v1(m, m.api).createOrder({ amount: 11100 });
    await dash(m, 'POST', '/api/payment-links', { amount: 5000 });

    // Log in as the viewer through the UI in a separate context.
    const vctx = await browser.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'X-Forwarded-For': randomIp() } });
    await prepareContext(vctx);
    const vp = await vctx.newPage();
    await vp.goto('/login');
    await vp.getByLabel('Work email').fill(viewerEmail);
    await vp.getByLabel('Password').fill('viewer-pass-1');
    await vp.getByRole('button', { name: 'Log in' }).click();
    await expect(vp).toHaveURL(/\/dashboard$/);
    await vp.locator('button[aria-haspopup="menu"]').click();
    await expect(vp.getByRole('menu')).toContainText('viewer');
    await vp.keyboard.press('Escape');

    await vp.goto('/dashboard/orders');
    await expect(vp.locator('tbody tr')).toHaveCount(1);
    await expect(vp.getByRole('button', { name: 'Create order' })).toHaveCount(0);
    await vp.goto(`/dashboard/orders/${order.id}`);
    await expect(vp.getByRole('button', { name: 'Copy checkout link' })).toBeVisible();
    await expect(vp.getByRole('button', { name: 'Mark as paid' })).toHaveCount(0);
    await expect(vp.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
    await vp.goto('/dashboard/payment-links');
    await expect(vp.getByRole('button', { name: 'Create payment link' })).toHaveCount(0);
    await expect(vp.getByRole('button', { name: 'Cancel link' })).toHaveCount(0);
    await vp.goto('/dashboard/refunds');
    await expect(vp.getByRole('button', { name: 'Create refund' })).toHaveCount(0);
    await vp.goto('/dashboard/settings/business');
    await expect(vp.getByLabel('Business name')).toBeDisabled();
    await expect(vp.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await vp.goto('/dashboard/settings/upi');
    await expect(vp.getByText(m.vpa)).toBeVisible();
    await expect(vp.getByRole('button', { name: 'Add UPI ID' })).toHaveCount(0);
    await vp.goto('/dashboard/settings/checkout');
    await expect(vp.getByLabel('Brand colour', { exact: true })).toBeDisabled();
    await expect(vp.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await vp.goto('/dashboard/settings/team');
    await expect(vp.getByRole('button', { name: 'Add member' })).toHaveCount(0);
    await expect(vp.getByRole('button', { name: /^Remove / })).toHaveCount(0);
    await vp.goto('/dashboard/developers/api-keys');
    await expect(vp.getByRole('button', { name: /Generate/ })).toHaveCount(0);
    await expect(vp.getByRole('button', { name: 'Revoke' })).toHaveCount(0);
    await vp.goto('/dashboard/developers/webhooks');
    await expect(vp.getByRole('button', { name: 'Add endpoint' })).toHaveCount(0);
    await vp.goto('/dashboard/verification?tab=observers');
    await expect(vp.getByRole('button', { name: 'Add forwarder' })).toHaveCount(0);
    await vp.goto('/dashboard/quick-collect');
    await expect(vp.getByRole('button', { name: /Show QR|Enter an amount/ })).toHaveCount(0);

    await vp.goto('/dashboard');
    await expect(vp.getByRole('heading', { level: 1 })).toContainText('Vik');
    await expect(vp.getByRole('button', { name: 'Activate', exact: true })).toHaveCount(0);
    // And the API itself refuses.
    const vapi = await apiContext();
    await vapi.post('/api/auth/login', { data: { email: viewerEmail, password: 'viewer-pass-1' } });
    const r = await vapi.post('/api/orders?mode=test', { data: { amount: 10000 } });
    expect(r.status()).toBe(403);
    await vctx.close();
  });
});
