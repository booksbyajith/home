import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { resetAll } from '../helpers/emulator.js';
import { adminLogin, makeUser } from './adminHelpers.js';
import { attachSlip, fillDetails, placeOrder, ready } from './orderHelpers.js';

test.beforeEach(async () => {
  await resetAll();
});

async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = r.violations.map(
    (v) =>
      `${v.id}: ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  );
  expect(summary, label).toEqual([]);
}

test('public pages have no axe violations', async ({ page }) => {
  for (const path of [
    '',
    'en/',
    'books/portuguese-era-1505-1594/',
    'en/books/finding-sinhabahu/',
    'track/',
    'faq/',
    'en/bulk-orders/',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await audit(page, path);
  }
});

test('every order step has no axe violations', async ({ page }) => {
  await page.goto('order/?book=portuguese-era-1505-1594');
  await ready(page);
  await audit(page, 'step 1');
  await page.click('[data-next-step]');
  await audit(page, 'step 2 empty');
  await page.click('[data-next-step]');
  await audit(page, 'step 2 with errors');
  await fillDetails(page);
  await page.click('[data-next-step]');
  await attachSlip(page);
  await audit(page, 'step 3');
  await page.click('[data-next-step]');
  await audit(page, 'step 4');
});

test('success page and admin order page have no axe violations', async ({ page, context }) => {
  const orderId = await placeOrder(page);
  await audit(page, 'success');
  await makeUser('admin@example.com', true);
  const admin = await context.newPage();
  await adminLogin(admin);
  await admin.goto(`admin/#/orders/${orderId}`);
  await expect(admin.locator('[data-screen="order-detail"]')).toBeVisible();
  await audit(admin, 'admin order');
});
