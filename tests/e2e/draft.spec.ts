import { expect, test } from '@playwright/test';
import { resetAll } from '../helpers/emulator.js';
import { CUSTOMER, attachSlip, fillDetails, ready } from './orderHelpers.js';

test.beforeEach(async () => {
  await resetAll();
});

test('refresh mid-form restores every field, the step, the cart and the slip', async ({ page, context }) => {
  await page.goto('order/?book=portuguese-era-1505-1594');
  await ready(page);
  await page.click('[data-add="finding-sinhabahu"]');
  await page.locator('[data-cart-book="finding-sinhabahu"] button[aria-label*="Finding"]').last().click(); // qty 2
  await expect(page.locator('[data-qty="finding-sinhabahu"]')).toHaveText('2');
  await page.click('[data-next-step]');
  await fillDetails(page, { ...CUSTOMER, line2: 'Flat 3' });
  await page.uncheck('#f-whatsappSame');
  await page.fill('#f-whatsapp', '+44 7700 900123');
  await page.check('#f-signedCopy');
  await page.fill('#f-dedicationNote', 'නිමල් සඳහා');
  await page.click('[data-next-step]');
  await attachSlip(page);
  await page.waitForTimeout(700); // debounce

  await page.reload();
  await ready(page);
  await expect(page.locator('[data-testid="draft-banner"]')).toBeVisible();
  await expect(page.locator('[data-order-app]')).toHaveAttribute('data-step', '2');
  await expect(page.locator('[data-testid="slip-preview"]')).toBeVisible();
  await expect(page.locator('[data-slip-name]')).toHaveText('slip.jpg');

  // A new tab (closed and reopened) restores the same draft.
  const tab = await context.newPage();
  await tab.goto('order/');
  await ready(tab);
  await expect(tab.locator('[data-testid="draft-banner"]')).toBeVisible();
  await tab.close();

  await page.click('text=← ');
  await expect(page.locator('#f-name')).toHaveValue(CUSTOMER.name);
  await expect(page.locator('#f-mobile')).toHaveValue(CUSTOMER.mobile);
  await expect(page.locator('#f-email')).toHaveValue(CUSTOMER.email);
  await expect(page.locator('#f-line1')).toHaveValue(CUSTOMER.line1);
  await expect(page.locator('#f-line2')).toHaveValue('Flat 3');
  await expect(page.locator('#f-city')).toHaveValue(CUSTOMER.city);
  await expect(page.locator('#f-postalCode')).toHaveValue(CUSTOMER.postalCode);
  await expect(page.locator('#f-districtId')).toHaveValue(CUSTOMER.district);
  await expect(page.locator('#f-landmark')).toHaveValue(CUSTOMER.landmark);
  await expect(page.locator('#f-whatsappSame')).not.toBeChecked();
  await expect(page.locator('#f-whatsapp')).toHaveValue('+44 7700 900123');
  await expect(page.locator('#f-signedCopy')).toBeChecked();
  await expect(page.locator('#f-dedicationNote')).toHaveValue('නිමල් සඳහා');
  await page.click('text=← ');
  await expect(page.locator('[data-qty="finding-sinhabahu"]')).toHaveText('2');
  await expect(page.locator('[data-qty="portuguese-era-1505-1594"]')).toHaveText('1');

  // Start over clears everything.
  page.once('dialog', (d) => d.accept());
  await page.click('[data-testid="draft-banner"] button');
  await expect(page.locator('[data-testid="draft-banner"]')).toBeHidden();
  await expect(page.locator('[data-add="portuguese-era-1505-1594"]')).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(page.locator('[data-testid="draft-banner"]')).toBeHidden();
  // The draft is either removed or replaced by an empty one; either way the old address is gone.
  expect((await page.evaluate(() => localStorage.getItem('aj.orderDraft.v1'))) ?? '').not.toContain(
    'Colombo',
  );
});
