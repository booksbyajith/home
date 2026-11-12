import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { call, db, resetAll } from '../helpers/emulator.js';
import { orderInput } from '../helpers/fixtures.js';
import { adminLogin, makeUser } from './adminHelpers.js';
import { ready } from './orderHelpers.js';

test.beforeEach(async () => {
  await resetAll();
  await makeUser('admin@example.com', true);
});

test('settings change the bank details shown on the order page', async ({ page, context }) => {
  await adminLogin(page);
  await page.goto('admin/#/settings');
  const bank = page.locator('[data-section="bank"]');
  await bank.locator('input[name="accountNumber"]').fill('111122223333');
  await bank.locator('[data-save]').click();
  await expect(bank.getByRole('status')).toBeVisible();
  const customer = await context.newPage();
  await customer.goto('order/?book=portuguese-era-1505-1594');
  await ready(customer);
  await customer.click('[data-next-step]');
  await customer.fill('#f-name', 'Test Customer');
  await customer.fill('#f-mobile', '0770000001');
  await customer.fill('#f-line1', '1 Road');
  await customer.fill('#f-city', 'Colombo');
  await customer.fill('#f-postalCode', '00100');
  await customer.selectOption('#f-districtId', 'colombo');
  await customer.click('[data-next-step]');
  await expect(customer.locator('[data-testid="bank"]')).toContainText('111122223333');
});

test('book price edit changes the order total', async ({ page, context }) => {
  await adminLogin(page);
  await page.goto('admin/#/books');
  const ed = page.locator('[data-section="book-portuguese-era-1505-1594"]');
  await ed.locator('input[name="priceLKR"]').fill('5000');
  await ed.locator('[data-save]').click();
  await expect(ed.getByRole('status')).toBeVisible();
  expect((await db.doc('books/portuguese-era-1505-1594').get()).get('priceLKR')).toBe(5000);
  const customer = await context.newPage();
  await customer.goto('order/?book=portuguese-era-1505-1594');
  await ready(customer);
  await expect(customer.locator('[data-cart-book="portuguese-era-1505-1594"]')).toContainText('Rs. 5,000');
});

test('CSV export and A4 label sheets', async ({ page }) => {
  const ids: string[] = [];
  for (let i = 0; i < 9; i++) {
    const r = await call(
      'createOrder',
      await orderInput({
        customer: {
          name: `Customer ${i}`,
          mobile: `07700001${String(i).padStart(2, '0')}`,
          whatsapp: `07700001${String(i).padStart(2, '0')}`,
        },
      }),
    );
    ids.push(r.result.orderId);
  }
  await adminLogin(page);
  await page.goto('admin/#/orders');
  await expect(page.locator('[data-order-row]')).toHaveCount(9);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-export-csv]')]);
  const csv = readFileSync((await dl.path())!, 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const lines = csv.replace(/\r\n$/, '').split(/\r\n/);
  expect(lines[0]).toBe(
    '﻿orderId,date,name,mobile,whatsapp,addressLine1,addressLine2,city,district,postalCode,landmark,items,totalQty,totalLKR,status,courier,trackingNo',
  );
  expect(lines).toHaveLength(10);
  expect(csv).toContain('Customer 3');

  await page.click('[data-print-labels]');
  await expect(page.locator('[data-sheet]')).toHaveCount(2);
  await expect(page.locator('[data-sheet]').first().locator('[data-label]')).toHaveCount(8);
  await expect(page.locator('[data-sheet]').nth(1).locator('[data-label]')).toHaveCount(1);
});

test('approving a review publishes it on the book page', async ({ page, context }) => {
  await db.doc('review_submissions/r1').set({
    slug: 'finding-sinhabahu',
    displayName: 'Thoughtful Reader',
    rating: 5,
    text: 'Clear, careful and fascinating.',
    lang: 'en',
    status: 'pending',
    createdAt: Timestamp.now(),
  });
  await adminLogin(page);
  await page.goto('admin/#/reviews');
  await page.click('[data-section="review-r1"] [data-approve]');
  await expect(page.locator('[data-section="review-r1"] [data-review-status]')).toHaveText('approved');
  const book = await context.newPage();
  await book.goto('en/books/finding-sinhabahu/');
  await book.locator('[data-reviews]').scrollIntoViewIfNeeded();
  await expect(book.locator('[data-reviews-list]')).toContainText('Thoughtful Reader');
});
