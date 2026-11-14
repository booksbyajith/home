import { expect, test } from '@playwright/test';
import { resetAll } from '../helpers/emulator.js';

// The "How to order" post fills the bank details and WhatsApp number from the admin settings.
for (const path of ['news/how-to-order/', 'en/news/how-to-order/', 'ta/news/how-to-order/']) {
  test(`how-to-order post shows the settings' bank details (${path})`, async ({ page }) => {
    await resetAll();
    await page.goto(path);
    await expect(page.locator('[data-config-text="bank-account-number"]')).toHaveText('000000000000');
    await expect(page.locator('[data-config-text="bank-account-name"]')).toHaveText('Demo Account Holder');
    await expect(page.locator('[data-config-text="bank-branch"]')).toHaveText('Demo Branch');
    const wa = page.locator('article a[data-config="whatsapp"]');
    await expect(wa).toHaveText('+94770000000');
    await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/94770000000/);
    await expect(page.locator('article a[href$="/order/"]')).toHaveCount(1);
  });
}

test('the order page shows how to order, with the settings bank details', async ({ page }) => {
  await resetAll();
  await page.goto('order/');
  const box = page.locator('[data-testid="how-to-order"]');
  await expect(box.locator('[data-config-text="bank-account-number"]')).toHaveText('000000000000');
  await expect(box.locator('[data-config-text="whatsapp-number"]')).toHaveText('+94770000000');
  await expect(box.locator('a')).toHaveCount(0);
});
