import { expect, test } from '@playwright/test';
import { resetAll } from '../helpers/emulator.js';
import { watchConsole } from './helpers.js';

test.beforeEach(async () => {
  await resetAll();
});

test.describe('site shell', () => {
  for (const [path, lang] of [
    ['', 'si'],
    ['en/', 'en'],
  ] as const) {
    test(`home ${lang} renders with SEO basics`, async ({ page, request }) => {
      const con = watchConsole(page);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
        'href',
        new RegExp(`/booksbyajith/${path}$`),
      );
      await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);
      const og = await page.locator('meta[property="og:image"]').getAttribute('content');
      expect((await request.get(og!)).status()).toBe(200);
      con.expectClean();
    });
  }

  test('language toggle links to the counterpart page', async ({ page }) => {
    await page.goto('');
    await page.locator('[data-lang-toggle="en"]').click();
    await expect(page).toHaveURL(/\/booksbyajith\/en\/$/);
    await page.locator('[data-lang-toggle="si"]').click();
    await expect(page).toHaveURL(/\/booksbyajith\/$/);
  });

  test('robots and sitemap exist; unknown path shows 404 page', async ({ page, request }) => {
    expect(await (await request.get('robots.txt')).text()).toContain('sitemap.xml');
    expect(await (await request.get('sitemap.xml')).text()).toContain('<urlset');
    await page.goto('does-not-exist/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('no request leaves 127.0.0.1 (fonts are bundled)', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('data:')) external.push(r.url());
    });
    await page.goto('');
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
    expect(await page.evaluate(() => document.fonts.check('16px "Noto Sans Sinhala"', 'ලංකාව'))).toBe(true);
  });
});
