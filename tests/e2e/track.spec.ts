import { expect, test } from '@playwright/test';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db, resetAll } from '../helpers/emulator.js';
import { CUSTOMER, placeOrder } from './orderHelpers.js';

test.beforeEach(async () => {
  await resetAll();
});

test('tracking with correct and wrong phone digits', async ({ page, browser }) => {
  const orderId = await placeOrder(page);
  await db.doc(`orders/${orderId}`).update({
    status: 'dispatched',
    statusHistory: FieldValue.arrayUnion(
      { status: 'acknowledged', at: Timestamp.now() },
      { status: 'payment_verified', at: Timestamp.now() },
      { status: 'dispatched', at: Timestamp.now() },
    ),
    dispatch: {
      courier: 'Demo Courier',
      trackingNo: 'TRK42',
      trackingUrl: 'https://courier.example.com/track?n=TRK42',
      dispatchedAt: new Date(),
    },
  });

  // Prefilled from "My orders" via the link on the success page.
  await page.goto(`track/#${orderId}`);
  await expect(page.locator('[data-testid="track-status"]')).toBeVisible();
  await expect(page.locator('#t-order')).toHaveValue(orderId);
  await expect(page.locator('#t-last4')).toHaveValue('0001');
  await expect(page.locator('[data-testid="track-courier"]')).toHaveText('Demo Courier');
  await expect(page.locator('[data-testid="track-number"]')).toHaveText('TRK42');
  await expect(page.locator('[data-testid="my-orders"]')).toContainText(orderId);
  const body = await page.locator('main').innerText();
  for (const pii of [CUSTOMER.name, '94770000001', '0770000001', CUSTOMER.email, CUSTOMER.line1])
    expect(body).not.toContain(pii);

  // Another device: no saved orders, manual entry.
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const other = await ctx.newPage();
  await other.goto(`track/#${orderId}`);
  await expect(other.locator('form:has(#t-order)[data-hydrated="true"]')).toBeVisible();
  await expect(other.locator('#t-order')).toHaveValue(orderId);
  await other.fill('#t-last4', '9999');
  await other.click('[data-track-submit]');
  await expect(other.locator('[data-testid="track-error"]')).toBeVisible();
  await expect(other.locator('[data-testid="track-result"]')).toHaveCount(0);
  await other.fill('#t-last4', '0001');
  await other.click('[data-track-submit]');
  await expect(other.locator('[data-step-status="dispatched"]')).toHaveAttribute('data-reached', 'true');
  await expect(other.locator('[data-step-status="delivered"]')).toHaveAttribute('data-reached', 'false');
  await ctx.close();

  // Remove from this device.
  await page.goto('track/');
  page.once('dialog', (d) => void d.accept());
  await page
    .getByRole('button', { name: /ඉවත් කරන්න/ })
    .first()
    .click();
  await expect(page.locator('[data-testid="my-orders"]')).toHaveCount(0);
});

test('removing an order from this device asks first', async ({ page }) => {
  const orderId = await placeOrder(page);
  await page.goto('track/');
  const mine = page.locator('[data-testid="my-orders"]');
  await expect(mine).toContainText(orderId);

  // Cancel the question: the order stays.
  page.once('dialog', (d) => {
    expect(d.message()).toContain(orderId);
    void d.dismiss();
  });
  await page.click(`[data-my-remove="${orderId}"]`);
  await expect(mine).toContainText(orderId);

  // Confirm: it is removed.
  page.once('dialog', (d) => void d.accept());
  await page.click(`[data-my-remove="${orderId}"]`);
  await expect(page.locator(`[data-my-remove="${orderId}"]`)).toHaveCount(0);
});
