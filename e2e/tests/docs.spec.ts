import { test, expect } from './fixtures';

test.describe('Docs', () => {
  test('renders, code tabs switch and copy works', async ({ page, isMobile }) => {
    await page.goto('/docs');
    await expect(page).toHaveTitle('Docs · OpenGateway');
    await expect(page.getByRole('heading', { level: 1, name: 'Accept UPI with OpenGateway' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1. Create an order' })).toBeVisible();

    const tablist = page.getByRole('tablist').first();
    const tabs = tablist.getByRole('tab');
    expect(await tabs.count()).toBeGreaterThan(1);
    const code = tablist.locator('xpath=../..').locator('pre');
    const firstCode = await code.textContent();
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'false');
    await expect(code).not.toHaveText(firstCode!);
    await tablist.locator('xpath=..').getByRole('button', { name: 'Copy to clipboard' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await code.textContent());

    // Every code sample references this gateway's origin, not a placeholder.
    await expect(page.locator('pre').filter({ hasText: page.url().replace(/\/docs$/, '') }).first()).toBeVisible();

    // Table of contents
    if (isMobile) {
      await page.getByRole('button', { name: 'Open docs menu' }).click();
    }
    await page.getByRole('navigation', { name: 'Docs' }).getByRole('link', { name: 'Errors & limits' }).click();
    await expect(page).toHaveURL(/#errors$/);
    await expect(page.getByRole('heading', { name: 'Errors & limits' }).first()).toBeInViewport();
  });

  test('"Get API keys" goes to the dashboard (login when signed out)', async ({ page }) => {
    await page.goto('/docs');
    await page.getByRole('link', { name: 'Get API keys' }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fdevelopers%2Fapi-keys$/);
  });
});
