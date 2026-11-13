import { expect, test } from '@playwright/test';
import { db, outbox, resetAll, waitFor } from '../helpers/emulator.js';
import { adminLogin, decodeWa, makeUser } from './adminHelpers.js';
import { CUSTOMER, placeOrder } from './orderHelpers.js';

test.beforeEach(async ({ context }) => {
  await resetAll();
  // WhatsApp tabs opened by the admin buttons must not leave the sandbox.
  await context.route('https://wa.me/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/plain', body: 'whatsapp' }),
  );
});

test('admin acknowledges, verifies and dispatches with WhatsApp links and emails', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const orderId = await placeOrder(page);
  await makeUser('admin@example.com', true);

  const admin = await context.newPage();
  await adminLogin(admin);
  await expect(admin.locator('[data-admin-state="admin"]')).toBeVisible();
  await expect(admin.locator('[data-count="pending_verification"] strong')).toHaveText('1');
  await admin.click('a[href="#/orders"]');
  await admin.click(`[data-order-row="${orderId}"] a`);
  await expect(admin.locator('[data-screen="order-detail"]')).toBeVisible();
  await expect(admin.locator('[data-testid="detail-address"]')).toContainText(CUSTOMER.line1);

  await admin.click('[data-view-slip]');
  await expect(admin.locator('[data-testid="slip-image"]')).toBeVisible();

  const title = 'ලංකාවේ පෘතුගීසි සිටි යුගය (1505-1594)';
  // 1. Acknowledge
  await Promise.all([context.waitForEvent('page'), admin.click('[data-action-to="acknowledged"]')]);
  await expect(admin.locator('[data-screen="order-detail"]')).toHaveAttribute(
    'data-order-status',
    'acknowledged',
  );
  await expect(admin.locator('[data-testid="wa-link"]')).toHaveAttribute('href', /%F0%9F%99%8F/); // 🙏 only in the acknowledged template
  let href = (await admin.locator('[data-testid="wa-link"]').getAttribute('href'))!;
  expect(href.startsWith('https://wa.me/94770000001?text=')).toBe(true);
  expect(decodeWa(href)).toBe(
    `${CUSTOMER.name}, ${title} ඇණවුම් කිරීම ගැන ඔබට ස්තුතියි! 🙏 ඔබගේ ඇණවුම් අංකය ${orderId}. අපි ඔබගේ බැංකු තැන්පතුව ඉක්මනින් තහවුරු කර පොත සූදානම් කිරීම අරඹන්නෙමු.`,
  );

  // 2. Payment verified
  await Promise.all([context.waitForEvent('page'), admin.click('[data-action-to="payment_verified"]')]);
  await expect(admin.locator('[data-screen="order-detail"]')).toHaveAttribute(
    'data-order-status',
    'payment_verified',
  );
  await expect(admin.locator('[data-testid="wa-link"]')).toHaveAttribute('href', /%E2%9C%85/); // ✅
  href = (await admin.locator('[data-testid="wa-link"]').getAttribute('href'))!;
  expect(decodeWa(href)).toBe(
    `ඇණවුම් අංක ${orderId} සඳහා ඔබගේ ගෙවීම තහවුරු විය ✅. අපි දැන් ඔබගේ පොත යැවීමට සූදානම් කරමින් සිටිමු.`,
  );

  // 3. Dispatch (requires courier and tracking number)
  await admin.click('[data-action-to="dispatched"]');
  await admin.click('[data-confirm-action]');
  await expect(admin.getByRole('alert')).toBeVisible();
  await admin.selectOption('#d-courier', 'Demo Courier');
  await admin.fill('#d-tracking', 'TRK777');
  await Promise.all([context.waitForEvent('page'), admin.click('[data-confirm-action]')]);
  await expect(admin.locator('[data-screen="order-detail"]')).toHaveAttribute(
    'data-order-status',
    'dispatched',
  );
  await expect(admin.locator('[data-testid="wa-link"]')).toHaveAttribute('href', /TRK777/);
  href = (await admin.locator('[data-testid="wa-link"]').getAttribute('href'))!;
  const msg = decodeWa(href);
  expect(msg).toContain(`${orderId} (${title}) Demo Courier මගින්`);
  expect(msg).toContain('TRK777');
  expect(msg).toContain(`http://127.0.0.1:4321/booksbyajith/track/#${orderId}`);
  expect(msg).toContain('https://www.facebook.com/example');
  await expect(admin.locator('[data-testid="audit-log"] li')).toHaveCount(5); // created + 3 status + slip view

  // Emails in the dev outbox
  const mails = await waitFor(async () => {
    const o = (await outbox((d) => d.meta?.orderId === orderId && d.channel === 'email')).map(
      (d) => `${d.meta.role}:${d.meta.event}`,
    );
    return o.length >= 4 ? o.sort() : null;
  });
  expect(mails).toEqual([
    'customer:dispatched',
    'customer:new_order',
    'customer:payment_verified',
    'team:new_order',
  ]);

  // The customer's tracking page shows the courier details.
  await page.goto(`track/#${orderId}`);
  await expect(page.locator('[data-testid="track-courier"]')).toHaveText('Demo Courier');
  await expect(page.locator('[data-testid="track-number"]')).toHaveText('TRK777');
});

test('one-tap status changes ask for confirmation first', async ({ page, context }) => {
  const orderId = await placeOrder(page);
  await makeUser('admin@example.com', true);
  const admin = await context.newPage();
  await admin.goto('admin/');
  await admin.fill('#emu-email', 'admin@example.com');
  await admin.fill('#emu-pass', 'password-123');
  await admin.click('[data-testid="emulator-signin"] button[type=submit]');
  await admin.goto(`admin/#/orders/${orderId}`);
  const ack = admin.locator('[data-action-to="acknowledged"]');
  await ack.waitFor();
  admin.once('dialog', (d) => void d.dismiss());
  await ack.click();
  await admin.waitForTimeout(800);
  const snap = await db.doc(`orders/${orderId}`).get();
  expect(snap.data()!.status).toBe('pending_verification');
});
