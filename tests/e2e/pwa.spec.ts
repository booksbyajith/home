import { expect, test } from '@playwright/test';
import { resetAll } from '../helpers/emulator.js';

test.use({ serviceWorkers: 'allow' });

test.beforeEach(async () => {
  await resetAll();
});

test('service worker registers and serves the offline page', async ({ page, context }) => {
  await page.goto('');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // let the worker control the page
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto('faq/').catch(() => undefined);
  await expect(page.locator('[data-offline]')).toBeVisible();
  await page.goto('en/contact/').catch(() => undefined);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-offline]')).toBeVisible();
  await context.setOffline(false);
});

test('manifest makes the site installable', async ({ request }) => {
  const m = await (await request.get('manifest.webmanifest')).json();
  expect(m.display).toBe('standalone');
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  expect((await request.get(m.icons[0].src.replace(/^\/booksbyajith\//, ''))).status()).toBe(200);
});
