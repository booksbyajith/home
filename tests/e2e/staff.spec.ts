import { expect, test, type Page } from '@playwright/test';
import { adminAuth, db, resetAll } from '../helpers/emulator.js';
import { placeOrder } from './orderHelpers.js';

test.beforeEach(async () => {
  await resetAll();
});

async function staffLogin(page: Page, email: string, staff: boolean) {
  const u = await adminAuth.createUser({ email, password: 'password-123' });
  if (staff) await adminAuth.setCustomUserClaims(u.uid, { staff: true });
  await page.goto('staff/');
  await page.fill('#emu-email', email);
  await page.fill('#emu-pass', 'password-123');
  await page.click('[data-testid="emulator-signin"] button[type=submit]');
}

async function verify(orderId: string) {
  // As the admin would: payment verified.
  const { Timestamp } = await import('firebase-admin/firestore');
  const ref = db.doc(`orders/${orderId}`);
  const o = (await ref.get()).data()!;
  await ref.update({
    status: 'payment_verified',
    statusHistory: [...o.statusHistory, { status: 'payment_verified', at: Timestamp.now() }],
  });
}

test('staff see verified orders, print 6-per-page labels with QR codes, and mark them packed', async ({
  page,
  context,
}) => {
  const verified = await placeOrder(page);
  const unverified = await placeOrder(page, 'order/?book=finding-sinhabahu');
  await verify(verified);

  const staff = await context.newPage();
  await staffLogin(staff, 'packer@example.com', true);
  await expect(staff.locator(`[data-staff-order="${verified}"]`)).toBeVisible();
  await expect(staff.locator(`[data-staff-order="${unverified}"]`)).toHaveCount(0);

  // Labels: one per order, each with its QR code, laid out for A4.
  await staff.evaluate(() => (window.print = () => undefined));
  await staff.click('[data-print-all]');
  await expect(staff.locator(`[data-label="${verified}"] img.label-qr`)).toBeAttached();
  await expect(staff.locator('.label-page')).toHaveCount(1);

  await staff.click(`[data-mark-packed="${verified}"]`);
  await expect(staff.locator('[data-staff-msg="ok"]')).toBeVisible();
  await expect.poll(async () => (await db.doc(`orders/${verified}`).get()).data()!.status).toBe('packed');
  // The SMS button opens the SMS app with the customer's number and a message naming the order.
  const sms = (await staff.locator(`[data-sms="${verified}"]`).first().getAttribute('href'))!;
  expect(sms.startsWith('sms:+94770000001?&body=')).toBe(true);
  expect(decodeURIComponent(sms)).toContain(verified);

  // Opening the label's QR link shows that order on its own.
  await staff.goto(`staff/#/scan/${verified}`);
  await expect(staff.locator(`[data-staff-order="${verified}"]`).first()).toBeVisible();
});

test('accounts without the staff role are turned away', async ({ page }) => {
  await staffLogin(page, 'someone@example.com', false);
  await expect(page.locator('[data-staff-state="notStaff"]')).toBeVisible();
});

test('the receipt shows who it is for', async ({ page }) => {
  await placeOrder(page);
  await expect(page.locator('[data-testid="receipt-customer"]')).toContainText('පරීක්ෂණ පාරිභෝගිකයා');
});
