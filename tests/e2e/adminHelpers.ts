import { expect, type Page } from '@playwright/test';
import { adminAuth } from '../helpers/emulator.js';

export async function makeUser(email: string, admin: boolean) {
  const u = await adminAuth.createUser({ email, password: 'password-123' });
  if (admin) await adminAuth.setCustomUserClaims(u.uid, { admin: true });
  return u.uid;
}

export async function adminLogin(page: Page, email = 'admin@example.com') {
  // Accept the "change this order to …?" confirmations; tests that check a dialog add their own.
  page.on('dialog', (d) => {
    if (d.type() === 'confirm') void d.accept().catch(() => undefined);
  });
  await page.goto('admin/');
  await expect(page.locator('[data-admin-state="signedOut"]')).toBeVisible();
  await page.fill('#emu-email', email);
  await page.fill('#emu-pass', 'password-123');
  await page.click('[data-testid="emulator-signin"] button[type=submit]');
}

export const decodeWa = (href: string) => decodeURIComponent(href.split('?text=')[1] ?? '');
