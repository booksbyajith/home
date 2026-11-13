import { expect, test } from '@playwright/test';
import { jpg } from '../helpers/files.js';
import { resetAll } from '../helpers/emulator.js';
import { CUSTOMER, fillDetails, ready } from './orderHelpers.js';
test('order form fits a phone screen with a long file name and address', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await resetAll();
  await page.goto('order/?book=portuguese-era-1505-1594');
  await ready(page);
  await page.click('[data-next-step]');
  await fillDetails(page, {
    ...CUSTOMER,
    line1: 'Unit 7/634, Loma Place',
    city: 'Albury',
    district: 'overseas',
    postalCode: '2640',
    country: 'Australia',
    mobile: '+61 412 345 678',
  });
  await page.click('[data-next-step]');
  await page.locator('[data-slip-input]').setInputFiles({
    name: 'HNB_Transfer_Receipt_13_11_2026_08_13_AM.jpg',
    mimeType: 'image/jpeg',
    buffer: await jpg(200, 300),
  });
  await page.locator('[data-testid="slip-preview"]').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const step of ['payment', 'review']) {
    if (step === 'review') await page.click('[data-next-step]');
    await page.waitForTimeout(500);
    // Compare with the phone's real width: when content overflows, mobile browsers widen the
    // layout (innerWidth) and zoom out, which is the bug this guards against.
    const w = await page.evaluate(() => ({
      layout: innerWidth,
      wide: [...document.querySelectorAll('main .card')]
        .filter((e) => e.getBoundingClientRect().right > 391)
        .map((e) => (e.textContent ?? '').trim().slice(0, 30)),
    }));
    expect(w.layout, step).toBeLessThanOrEqual(390);
    expect(w.wide, step).toEqual([]);
  }
  const small = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea',
      ),
    ]
      .map((e) => [e.id, getComputedStyle(e).fontSize])
      .filter(([, f]) => parseFloat(f) < 16),
  );
  // iOS zooms into any field with text under 16px.
  expect(small).toEqual([]);
});
