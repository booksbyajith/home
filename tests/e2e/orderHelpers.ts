import { expect, type Page } from '@playwright/test';
import { jpg } from '../helpers/files.js';

export const CUSTOMER = {
  name: 'පරීක්ෂණ පාරිභෝගිකයා',
  mobile: '077 000 0001',
  email: 'customer@example.com',
  line1: '12 පන්සල් පාර',
  line2: '',
  city: 'Colombo',
  district: 'colombo',
  postalCode: '00100',
  landmark: 'Near the test tower',
  country: '',
};

export async function ready(page: Page) {
  await expect(page.locator('[data-order-app][data-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-testid="summary"], [data-cart-book]').first()).toBeVisible();
}

export async function fillDetails(page: Page, c = CUSTOMER) {
  await page.fill('#f-name', c.name);
  await page.fill('#f-mobile', c.mobile);
  await page.fill('#f-email', c.email);
  await page.fill('#f-line1', c.line1);
  if (c.line2) await page.fill('#f-line2', c.line2);
  await page.fill('#f-city', c.city);
  await page.fill('#f-postalCode', c.postalCode);
  await page.selectOption('#f-districtId', c.district);
  if (c.country) await page.selectOption('#f-country', c.country);
  await page.fill('#f-landmark', c.landmark);
}

export async function attachSlip(page: Page) {
  await page
    .locator('[data-slip-input]')
    .setInputFiles({ name: 'slip.jpg', mimeType: 'image/jpeg', buffer: await jpg(200, 300) });
  await expect(page.locator('[data-testid="slip-preview"]')).toBeVisible();
}

/** Full happy path; returns the order id from the success page. */
export async function placeOrder(
  page: Page,
  path = 'order/?book=portuguese-era-1505-1594',
  c = CUSTOMER,
): Promise<string> {
  await page.goto(path);
  await ready(page);
  await page.click('[data-next-step]');
  await fillDetails(page, c);
  await page.click('[data-next-step]');
  await attachSlip(page);
  await page.click('[data-next-step]');
  await page.check('#f-consent');
  await page.click('[data-submit]');
  await page.waitForURL(/\/order\/success\/#AJ-\d{4}-[A-Z0-9]{4}$/, { timeout: 30_000 });
  const id = (await page.locator('[data-testid="order-id"]').textContent())!.trim();
  return id;
}
