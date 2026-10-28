import { test, expect, expectNoHorizontalScroll } from './fixtures';

test.describe('Landing', () => {
  test('loads, shows the hero and the CTA goes to signup', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/OpenGateway/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Accept UPI payments');
    await page.getByRole('link', { name: /Start accepting payments/ }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  });

  test('header CTA, docs link and FAQ accordion work', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Get started free' }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await page.goBack();
    await page.getByRole('link', { name: 'Read the docs' }).click();
    await expect(page).toHaveURL(/\/docs$/);
    await page.goBack();
    const faq = page.locator('#faq').getByRole('button').nth(1);
    await expect(faq).toHaveAttribute('aria-expanded', 'false');
    await faq.click();
    await expect(faq).toHaveAttribute('aria-expanded', 'true');
  });

  test('unknown routes show a friendly 404', async ({ page }) => {
    await page.goto('/definitely-not-here');
    await expect(page.getByRole('heading', { name: "This page doesn't exist" })).toBeVisible();
    await page.getByRole('link', { name: 'Go to the homepage' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('no horizontal scroll at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
