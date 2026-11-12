import { expect, test } from '@playwright/test';
import { resetAll, signIn } from '../helpers/emulator.js';
import { adminLogin, makeUser } from './adminHelpers.js';
import { placeOrder } from './orderHelpers.js';

test.beforeEach(async () => {
  await resetAll();
});

test('a signed-in user without the admin claim is blocked', async ({ page, context }) => {
  const orderId = await placeOrder(page);
  await makeUser('reader@example.com', false);
  const p = await context.newPage();
  const firestoreReads: string[] = [];
  p.on(
    'request',
    (r) => r.url().includes(':8080/') && r.url().includes('/orders') && firestoreReads.push(r.url()),
  );
  await adminLogin(p, 'reader@example.com');
  await expect(p.locator('[data-testid="not-authorised"]')).toBeVisible();
  await expect(p.locator('[data-screen]')).toHaveCount(0);
  expect(await p.locator('body').innerText()).not.toContain(orderId);
  expect(firestoreReads).toEqual([]);

  // A direct Firestore read with this user's token is denied by the rules.
  const token = await signIn('reader@example.com', 'password-123');
  const res = await fetch(
    `http://127.0.0.1:8080/v1/projects/demo-ajith/databases/(default)/documents/orders/${orderId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  expect(res.status).toBe(403);
});

test('a signed-out visitor sees only the sign-in button', async ({ page }) => {
  await page.goto('admin/');
  await expect(page.locator('[data-admin-state="signedOut"]')).toBeVisible();
  await expect(page.locator('[data-google-signin]')).toBeVisible();
  await expect(page.locator('[data-screen]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
