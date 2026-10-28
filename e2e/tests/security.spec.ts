import { test, expect, createMerchant, loginContext, toast, apiContext } from './fixtures';

test.describe('Security', () => {
  test('change password: validation, wrong current password, success revokes other sessions', async ({ page, context }) => {
    const m = await createMerchant();
    await loginContext(context, m);
    // A second session (e.g. another device) that should be signed out by the change.
    const other = await apiContext();
    expect((await other.post('/api/auth/login', { data: { email: m.email, password: m.password } })).ok()).toBeTruthy();

    await page.goto('/dashboard/settings/security');
    await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
    await expect(page.getByText(m.email)).toBeVisible();

    const submit = page.getByRole('button', { name: 'Change password' });
    await submit.click();
    await expect(page.getByText('Enter your current password')).toBeVisible();
    await expect(page.getByText('Use at least 8 characters')).toBeVisible();

    await page.getByLabel('Current password').fill('definitely-wrong');
    await page.getByLabel('New password', { exact: true }).fill('brand-new-pass-1');
    await page.getByLabel('Confirm new password').fill('brand-new-pass-2');
    await submit.click();
    await expect(page.getByText("Passwords don't match")).toBeVisible();

    await page.getByLabel('Confirm new password').fill('brand-new-pass-1');
    await submit.click();
    await expect(page.getByText('Current password is incorrect')).toBeVisible();
    await expect(page.getByLabel('Current password')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Current password').fill(m.password);
    await submit.click();
    await expect(toast(page, 'Password changed')).toBeVisible();
    await expect(page.getByLabel('Current password')).toHaveValue('');

    // This browser keeps working (it got a fresh cookie); the other session is gone.
    await page.goto('/dashboard/orders');
    await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
    expect((await other.get('/api/auth/me')).status()).toBe(401);

    const fresh = await apiContext();
    expect((await fresh.post('/api/auth/login', { data: { email: m.email, password: m.password } })).status()).toBe(401);
    expect((await fresh.post('/api/auth/login', { data: { email: m.email, password: 'brand-new-pass-1' } })).ok()).toBeTruthy();
  });

  test('login page explains an account lockout after repeated failures', async ({ page }) => {
    const m = await createMerchant();
    // Fail from different addresses so it's the per-account lock, not the per-IP rate limit, that trips.
    let last = 0;
    for (let i = 0; i < 12 && last !== 429; i++) {
      const api = await apiContext();
      last = (await api.post('/api/auth/login', { data: { email: m.email, password: `wrong-${i}-password` } })).status();
      await api.dispose();
    }
    expect(last).toBe(429);

    await page.goto('/login');
    await page.getByLabel('Work email').fill(m.email);
    await page.getByLabel('Password').fill(m.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /Too many failed login attempts.*try again in \d+ (minutes?|seconds)/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
