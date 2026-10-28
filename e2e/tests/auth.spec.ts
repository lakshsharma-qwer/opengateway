import { test, expect, seedCreds, uid, createMerchant, toast } from './fixtures';

test.describe('Signup', () => {
  test('client-side validation errors', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter your name')).toBeVisible();
    await expect(page.getByText('Enter your business name')).toBeVisible();
    await expect(page.getByText('Enter a valid phone number')).toBeVisible();
    await expect(page.getByText('Enter a valid email')).toBeVisible();
    await expect(page.getByText('Use at least 8 characters')).toBeVisible();

    await page.getByLabel('Your name').fill('Asha Rao');
    await page.getByLabel('Business name').fill('Chai Point');
    await page.getByLabel('Phone').fill('98765 43210');
    await page.getByLabel('Work email').fill('not-an-email');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter a valid email')).toBeVisible();
    await expect(page.getByText('Use at least 8 characters')).toBeVisible();
    await expect(page.getByLabel('Work email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Enter your name')).toBeHidden();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('duplicate email shows a server error on the email field', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Your name').fill('Asha Rao');
    await page.getByLabel('Business name').fill('Chai Point');
    await page.getByLabel('Phone').fill('9876543210');
    await page.getByLabel('Work email').fill(seedCreds().dashboard.email);
    await page.getByLabel('Password').fill('long-enough-pass');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('An account with this email already exists')).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('signup → key modal → full onboarding wizard → dashboard', async ({ page }) => {
    const id = uid();
    const email = `owner_${id}@e2e.test`;
    await page.goto('/signup');
    await page.getByLabel('Your name').fill('Ravi Kumar');
    await page.getByLabel('Business name').fill(`Ravi Sweets ${id}`);
    await page.getByLabel('Phone').fill('9876543210');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password').fill('long-enough-pass');
    await page.getByRole('button', { name: 'Create account' }).click();

    // The one-time key modal
    const modal = page.getByRole('dialog', { name: /Your test API key/ });
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/^og_test_/)).toBeVisible();
    await expect(modal.locator('code').nth(1)).toHaveText(/^\S{20,}$/);
    await modal.getByRole('button', { name: "I've saved it, continue" }).click();

    // Step 1: business details
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: 'Tell us about your business' })).toBeVisible();
    await expect(page.getByLabel('Business name')).toHaveValue(`Ravi Sweets ${id}`);
    await expect(page.getByLabel('Support email')).toHaveValue(email);
    await page.getByLabel('Business type').selectOption('proprietorship');
    await page.getByLabel(/Website/).fill('https://ravisweets.example');
    await page.getByLabel('Support email').fill('bad-email');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('Enter a valid email')).toBeVisible();
    await page.getByLabel('Support email').fill(`help_${id}@e2e.test`);
    await page.getByRole('button', { name: 'Save and continue' }).click();

    // Step 2: UPI ID
    await expect(page.getByRole('heading', { name: 'Add the UPI ID you get paid on' })).toBeVisible();
    await page.getByLabel('UPI ID (VPA)').fill('not a vpa');
    await page.getByRole('button', { name: 'Add UPI ID' }).click();
    await expect(page.getByText('Enter a UPI ID like yourname@okhdfcbank')).toBeVisible();
    await page.getByLabel('UPI ID (VPA)').fill(`ravi${id}@okhdfcbank`);
    await page.getByRole('button', { name: 'Add UPI ID' }).click();
    await expect(toast(page, 'UPI ID added')).toBeVisible();

    // Step 3: verification (observer + playground); go back and forward once
    await expect(page.getByRole('heading', { name: 'Set up automatic verification' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText(`ravi${id}@okhdfcbank`)).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Create ingest URL' }).click();
    await expect(page.getByText(/\/v1\/observers\/ingest\?token=/)).toBeVisible();
    await page.getByRole('button', { name: 'Parse message' }).click();
    await expect(page.getByText('₹499.01', { exact: true })).toBeVisible();
    await expect(page.getByText('412345678901', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 4: done
    await expect(page.getByRole('heading', { name: "You're ready to accept test payments" })).toBeVisible();
    await page.getByRole('button', { name: 'Go to dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ravi');
    await expect(page.getByText('Finish setting up')).toBeHidden();
  });

  test('"Skip for now" leaves a setup banner on the dashboard', async ({ page, context }) => {
    const m = await createMerchant({ onboarded: false, vpa: false });
    const state = await m.api.storageState();
    await context.addCookies(state.cookies);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByRole('link', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Finish setting up')).toBeVisible();
    await page.getByRole('link', { name: 'Continue setup' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});

test.describe('Login', () => {
  test('logout, wrong password, then log back in', async ({ page, context }) => {
    const m = await createMerchant();
    await context.addCookies((await m.api.storageState()).cookies);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Asha');

    await page.locator('button[aria-haspopup="menu"]').click();
    await expect(page.getByRole('menu')).toContainText(m.email);
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // Logged out: the dashboard redirects to login with ?next
    await page.goto('/dashboard/orders');
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Forders$/);

    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Enter a valid email')).toBeVisible();
    await expect(page.getByText('Enter your password')).toBeVisible();

    await page.getByLabel('Work email').fill(m.email);
    await page.getByLabel('Password').fill('wrong-password-1');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Incorrect email or password' })).toBeVisible();

    await page.getByLabel('Password').fill(m.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard\/orders$/);
    await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
  });

  test('login and signup pages link to each other; logged-in users skip them', async ({ page, context }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await page.getByRole('link', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/login$/);

    const m = await createMerchant();
    await context.addCookies((await m.api.storageState()).cookies);
    await page.goto('/signup');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
