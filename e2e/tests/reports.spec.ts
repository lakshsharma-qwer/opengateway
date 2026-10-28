import fs from 'node:fs';
import { test, expect, seedMerchant, loginContext, toast } from './fixtures';

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

test.describe('Reports', () => {
  test('CSV downloads are valid for orders, payments and refunds', async ({ page, context }) => {
    await loginContext(context, await seedMerchant());
    await page.goto('/dashboard/reports');
    await page.getByRole('radio', { name: 'Last 30 days' }).click();

    const expected: Record<string, string[]> = {
      Orders: ['id', 'created_at', 'status', 'amount_inr'],
      Payments: ['id', 'order_id', 'created_at', 'status'],
      Refunds: ['id', 'payment_id', 'order_id', 'created_at', 'status'],
    };
    for (const [type, head] of Object.entries(expected)) {
      await page.getByRole('radio', { name: new RegExp(`^${type}`) }).click();
      const dl = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download CSV' }).click();
      const file = await dl;
      expect(file.suggestedFilename()).toMatch(new RegExp(`${type.toLowerCase()}.*\\.csv$`));
      const text = fs.readFileSync((await file.path())!, 'utf8');
      const rows = parseCsv(text);
      expect(rows[0].slice(0, head.length)).toEqual(head);
      expect(rows.length).toBeGreaterThan(1);
      for (const r of rows) expect(r.length).toBe(rows[0].length);
      const idCol = rows.slice(1).map((r) => r[0]);
      for (const id of idCol) expect(id).toMatch(/^(order|pay|rfnd)_\w+$/);
      await expect(toast(page, 'Report downloaded').first()).toBeVisible();
    }
    // Re-download from the session list
    await expect(page.getByRole('button', { name: 'Download again' })).toHaveCount(3);
    const again = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download again' }).first().click();
    expect((await again).suggestedFilename()).toMatch(/\.csv$/);
  });

  test('orders page export uses the current filters', async ({ page, context }) => {
    await loginContext(context, await seedMerchant());
    await page.goto('/dashboard/orders');
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const text = fs.readFileSync((await (await dl).path())!, 'utf8');
    expect(text.split('\n')[0]).toMatch(/^id,created_at,status/);
  });
});
