import { expect, test } from '@playwright/test';
import { bucket, db, resetAll } from '../helpers/emulator.js';
import { watchConsole } from './helpers.js';
import { adminLogin, makeUser } from './adminHelpers.js';
import { CUSTOMER, attachSlip, fillDetails, placeOrder, ready } from './orderHelpers.js';

test.beforeEach(async () => {
  await resetAll();
});

test('full order with two books and a slip upload', async ({ page }) => {
  const con = watchConsole(page);
  await page.goto('order/?book=portuguese-era-1505-1594');
  await ready(page);
  await expect(page.locator('[data-qty="portuguese-era-1505-1594"]')).toHaveText('1');
  await page.click('[data-add="finding-sinhabahu"]');
  await expect(page.locator('[data-cart-book="chinese-expedition"]')).toContainText(/තොග අවසන්/);
  await page.click('[data-next-step]');

  // Validation shows errors and blocks progress.
  await page.click('[data-next-step]');
  await expect(page.locator('#f-name-err')).toBeVisible();
  await expect(page.locator('#f-mobile')).toHaveAttribute('aria-invalid', 'true');

  await fillDetails(page);
  await page.click('[data-next-step]');

  // 4500 + 2500 = 7000; bundle 10% = 700; Colombo 350 + 100 for the extra copy.
  await expect(page.locator('[data-testid="pay-amount"]')).toHaveText('Rs. 6,750');
  await expect(page.locator('[data-testid="bank"]')).toContainText('000000000000');
  await page.click('[data-next-step]');
  await expect(page.getByRole('alert')).toBeVisible(); // slip required
  await attachSlip(page);
  await page.click('[data-next-step]');

  await expect(page.locator('[data-submit]')).toBeDisabled();
  await page.check('#f-consent');
  await page.click('[data-submit]');
  await page.waitForURL(/\/order\/success\/#AJ-\d{4}-[2-9A-HJKMNP-TV-Z]{4}$/, { timeout: 30_000 });
  const orderId = (await page.locator('[data-testid="order-id"]').textContent())!.trim();
  await expect(page.locator('[data-testid="success-total"]')).toHaveText('Rs. 6,750');
  await expect(page.locator('[data-testid="success-wa"]')).toHaveAttribute(
    'href',
    new RegExp(`^https://wa\\.me/94770000000\\?text=.*${orderId}`),
  );

  const order = (await db.doc(`orders/${orderId}`).get()).data()!;
  expect(order.totals.grandTotalLKR).toBe(6750);
  expect(order.totalMismatch).toBe(false);
  expect(order.customer.mobile).toBe('94770000001');
  expect(order.lang).toBe('si');
  expect(order.items.map((i: { slug: string }) => i.slug)).toEqual([
    'portuguese-era-1505-1594',
    'finding-sinhabahu',
  ]);
  expect((await bucket.file(order.slip.path).exists())[0]).toBe(true);

  const storage = await page.evaluate(() => ({
    draft: localStorage.getItem('aj.orderDraft.v1'),
    mine: JSON.parse(localStorage.getItem('aj.myOrders.v1') ?? '[]'),
  }));
  expect(storage.draft).toBeNull();
  expect(storage.mine[0]).toMatchObject({ orderId, phoneLast4: '0001', totalLKR: 6750 });
  con.expectClean();
});

test('closed ordering blocks checkout', async ({ page }) => {
  await db.doc('config/public').update({ ordersOpen: false });
  await page.goto('order/');
  await ready(page);
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.locator('[data-next-step]')).toBeDisabled();
});

test('overseas order: country field, international mobile, postage to be confirmed', async ({
  page,
  context,
}) => {
  const orderId = await placeOrder(page, 'order/?book=portuguese-era-1505-1594', {
    ...CUSTOMER,
    mobile: '+61 412 345 678',
    city: 'Albury',
    district: 'overseas',
    postalCode: '2640',
    country: 'Australia',
  });
  expect(orderId).toMatch(/^AJ-/);
  await makeUser('admin@example.com', true);
  const admin = await context.newPage();
  await adminLogin(admin);
  await admin.goto(`admin/#/orders/${orderId}`);
  await expect(admin.locator('[data-testid="detail-address"]')).toContainText('Australia 2640');
});

test('a visitor outside Sri Lanka gets overseas delivery and their country pre-filled', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    timezoneId: 'Australia/Sydney',
    baseURL: test.info().project.use.baseURL,
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  await page.goto('en/order/?book=portuguese-era-1505-1594');
  await ready(page);
  await page.click('[data-next-step]');
  await expect(page.locator('#f-districtId')).toHaveValue('overseas');
  await expect(page.locator('#f-country')).toHaveValue('Australia');
  await expect(page.locator('[data-testid="overseas-note"]')).toBeVisible();
  await ctx.close();
});
