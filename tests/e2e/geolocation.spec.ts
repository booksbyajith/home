import { expect, test } from '@playwright/test';
import { db, resetAll } from '../helpers/emulator.js';
import { attachSlip, fillDetails, ready } from './orderHelpers.js';

test.beforeEach(async () => {
  await resetAll();
});

test('location is captured, linked to Google Maps and stored with the order', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 6.9271, longitude: 79.8612, accuracy: 12 });
  await page.goto('order/?book=portuguese-era-1505-1594');
  await ready(page);
  await page.click('[data-next-step]');
  await fillDetails(page);
  await page.click('[data-geo-button]');
  await expect(page.locator('[data-geo-link]')).toHaveAttribute(
    'href',
    'https://maps.google.com/?q=6.9271,79.8612',
  );
  await page.click('[data-next-step]');
  await attachSlip(page);
  await page.click('[data-next-step]');
  await page.check('#f-consent');
  await page.click('[data-submit]');
  await page.waitForURL(/order\/success\//);
  const orderId = (await page.locator('[data-testid="order-id"]').textContent())!.trim();
  const geo = (await db.doc(`orders/${orderId}`).get()).get('geo');
  expect(geo).toMatchObject({ lat: 6.9271, lng: 79.8612, accuracyM: 12 });
  expect(geo.capturedAt).toBeTruthy();
});

test('denied permission shows a message and the order can still be placed', async ({ page, context }) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, err) =>
      err?.({
        code: 1,
        message: 'denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
  });
  await page.goto('order/?book=portuguese-era-1505-1594');
  await ready(page);
  await page.click('[data-next-step]');
  await fillDetails(page);
  await page.click('[data-geo-button]');
  await expect(page.locator('[data-geo-error="denied"]')).toBeVisible();
  await page.click('[data-next-step]');
  await attachSlip(page);
  await page.click('[data-next-step]');
  await page.check('#f-consent');
  await page.click('[data-submit]');
  await page.waitForURL(/order\/success\//);
  const orderId = (await page.locator('[data-testid="order-id"]').textContent())!.trim();
  expect((await db.doc(`orders/${orderId}`).get()).get('geo')).toBeNull();
});
