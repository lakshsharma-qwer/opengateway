import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, seedMerchant, loginContext, createMerchant, v1 } from './fixtures';

async function axe(page: Page) {
  // Let entrance animations (fade/slide-in) finish so contrast is measured on the final frame.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  );
  // preload:false stops axe from re-fetching cross-origin stylesheets (which the app's CSP rightly blocks).
  const results = await new AxeBuilder({ page }).options({ preload: false } as never).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  const bad = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.help}\n    ${v.nodes.slice(0, 8).map((n) => `${n.target.join(' ')} — ${(n.any[0]?.message ?? n.failureSummary ?? '').split('\n')[0].slice(0, 160)}`).join('\n    ')}`);
  expect(bad, `axe violations on ${page.url()}`).toEqual([]);
}

const INTERACTIVE = 'a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), [role=button], [role=link], [role=tab], [role=radio], [role=switch]';

/**
 * Tab through the whole page and check that every visible, enabled
 * interactive element receives focus and has an accessible name.
 */
async function keyboardAudit(page: Page) {
  // Start sequential focus navigation from the very top of the document.
  await page.evaluate(() => {
    document.querySelectorAll('[data-kb-seen]').forEach((e) => e.removeAttribute('data-kb-seen'));
    document.getElementById('kb-start')?.remove();
    const start = document.createElement('div');
    start.id = 'kb-start';
    start.tabIndex = -1;
    document.body.prepend(start);
    start.focus();
  });
  const names: string[] = [];
  for (let i = 0; i < 150; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return { done: true, name: '', again: false };
      const again = el.hasAttribute('data-kb-seen');
      el.setAttribute('data-kb-seen', '1');
      const byIds = (ids: string | null) => (ids ? ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : '');
      const labels = 'labels' in el && (el as HTMLInputElement).labels ? Array.from((el as HTMLInputElement).labels!).map((l) => l.textContent).join(' ') : '';
      const name = (el.getAttribute('aria-label') || byIds(el.getAttribute('aria-labelledby')) || labels || el.getAttribute('title') || (el as HTMLInputElement).placeholder || el.textContent || '').trim();
      return { done: false, name: `${el.tagName.toLowerCase()} "${name}"`, again, empty: !name };
    });
    if (r.done || r.again) break;
    expect(r.name, 'focused element needs an accessible name').not.toMatch(/""$/);
    names.push(r.name);
  }
  const missed = await page.evaluate((sel) => {
    const visible = (el: Element) => {
      const s = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && s.visibility !== 'hidden' && !el.closest('[aria-hidden="true"],[inert]');
    };
    return Array.from(document.querySelectorAll(sel))
      .filter((el) => visible(el) && !(el as HTMLButtonElement).disabled && el.getAttribute('tabindex') !== '-1' && !el.hasAttribute('data-kb-seen'))
      .map((el) => `${el.tagName.toLowerCase()} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}`);
  }, INTERACTIVE);
  expect(missed, 'interactive elements not reachable with Tab').toEqual([]);
  return names;
}

test.describe('Accessibility', () => {
  test('landing page has no serious axe violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await axe(page);
  });

  test('login page: axe clean, keyboard reachable, all controls named', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Log in to OpenGateway' })).toBeVisible();
    await axe(page);
    const stops = await keyboardAudit(page);
    expect(stops.join('\n')).toContain('Work email');
    expect(stops.join('\n')).toContain('Log in');
    // Error state is announced
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByLabel('Work email')).toHaveAttribute('aria-invalid', 'true');
    await axe(page);
  });

  test('signup page has no serious axe violations', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await axe(page);
  });

  test('dashboard home has no serious axe violations', async ({ page, context }) => {
    await loginContext(context, await seedMerchant());
    await page.goto('/dashboard');
    await expect(page.locator('tbody tr').first()).toContainText(/order_/);
    await axe(page);
    await page.goto('/dashboard/orders');
    await expect(page.locator('tbody tr').first()).toContainText(/order_/);
    await axe(page);
  });

  test('checkout: axe clean, keyboard reachable, all controls named', async ({ page }) => {
    const m = await createMerchant();
    const o = await v1(m, m.api).createOrder({ amount: 49900 });
    await page.goto(new URL(o.checkout_url).pathname);
    await expect(page.getByRole('button', { name: 'I have paid' })).toBeVisible();
    await axe(page);
    const stops = (await keyboardAudit(page)).join('\n');
    expect(stops).toContain('I have paid');
    expect(stops).toContain('Cancel payment');
    // Confirm screen
    await page.getByRole('button', { name: 'I have paid' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm your payment' })).toBeVisible();
    await axe(page);
    await keyboardAudit(page);
    // Cancel dialog traps the user in a sensible place
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Cancel payment' }).click();
    await expect(page.getByRole('dialog', { name: 'Cancel this payment?' })).toBeVisible();
    await axe(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Cancel this payment?' })).toBeHidden();
  });
});
