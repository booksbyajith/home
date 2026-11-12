import { expect, test } from '@playwright/test';
import { resetAll } from '../helpers/emulator.js';
import { CUSTOMER, placeOrder } from './orderHelpers.js';

test.beforeEach(async () => {
  await resetAll();
});

const PII = [
  CUSTOMER.name,
  '0770000001',
  '94770000001',
  '077 000 0001',
  CUSTOMER.email,
  CUSTOMER.line1,
  CUSTOMER.landmark,
];
const enc = (s: string) => [s, encodeURIComponent(s)];

test('personal data never appears in URLs, query strings or console output', async ({ page }) => {
  const urls: string[] = [];
  const logs: string[] = [];
  const bodies: { url: string; body: string }[] = [];
  page.on('request', (r) => {
    urls.push(r.url());
    const b = r.postData();
    if (b) bodies.push({ url: r.url(), body: b });
  });
  page.on('console', (m) => logs.push(m.text()));
  const orderId = await placeOrder(page);
  await page.goto(`track/#${orderId}`);
  await page.waitForLoadState('networkidle');

  for (const value of PII.flatMap(enc)) {
    for (const u of urls) expect(u, `URL leaks "${value}"`).not.toContain(value);
    for (const l of logs) expect(l, `console leaks "${value}"`).not.toContain(value);
  }
  // The only request that carries the customer's details is the createOrder call.
  const carrying = bodies.filter((b) => b.body.includes(CUSTOMER.email)).map((b) => new URL(b.url).pathname);
  expect(carrying).toEqual(['/demo-ajith/asia-south1/createOrder']);
});
