import { expect, test } from '@playwright/test';
import { STATIC_ROUTES } from '../../site/src/lib/routes.js';
import { resetAll } from '../helpers/emulator.js';
import { watchConsole } from './helpers.js';

const BOOKS = ['portuguese-era-1505-1594', 'finding-sinhabahu', 'chinese-expedition'];
const POSTS = ['news/book-launch-portuguese-era/', 'blog/welcome/'];
const ROUTES = [
  ...STATIC_ROUTES.map((r) => r.path),
  ...BOOKS.map((b) => `/books/${b}/`),
  ...POSTS.map((p) => `/${p}`),
];

test.beforeAll(async () => {
  await resetAll();
});

test.describe('every route, both languages', () => {
  test.skip(({ isMobile }) => isMobile, 'route sweep runs once (desktop)');
  for (const lang of ['si', 'en'] as const) {
    test(`all routes in ${lang}`, async ({ page, request }) => {
      test.setTimeout(180_000);
      const ogChecked = new Set<string>();
      for (const route of ROUTES) {
        const path = (lang === 'en' ? 'en' + route : route).replace(/^\//, '');
        const con = watchConsole(page);
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(200);
        await expect(page.locator('html'), path).toHaveAttribute('lang', lang);
        await expect(page.locator('h1'), path).toHaveCount(1);
        expect(await page.locator('link[rel=canonical]').getAttribute('href'), path).toMatch(
          new RegExp(`/booksbyajith/${path}$`),
        );
        await expect(page.locator('meta[http-equiv="content-security-policy"]'), path).toHaveCount(1);
        const og = (await page.locator('meta[property="og:image"]').getAttribute('content'))!;
        if (!ogChecked.has(og)) {
          expect((await request.get(og)).status(), og).toBe(200);
          ogChecked.add(og);
        }
        await page.waitForLoadState('networkidle');
        con.expectClean();
      }
    });
  }
});

test.describe('site shell', () => {
  test('language toggle maps pages to their counterpart', async ({ page }) => {
    await page.goto('books/finding-sinhabahu/');
    await page.locator('[data-lang-toggle="en"]').first().click();
    await expect(page).toHaveURL(/\/booksbyajith\/en\/books\/finding-sinhabahu\/$/);
    await page.goto('en/news/book-launch-portuguese-era/');
    await page.locator('[data-lang-toggle="si"]').first().click();
    await expect(page).toHaveURL(/\/booksbyajith\/news\/book-launch-portuguese-era\/$/);
  });

  test('book pages carry valid Book JSON-LD and book OG tags', async ({ page }) => {
    await page.goto('en/books/finding-sinhabahu/');
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    expect(ld['@type']).toBe('Book');
    expect(ld.isbn).toBe('978-955-665-398-4');
    expect(ld.numberOfPages).toBe(334);
    expect(ld.award).toContain('Winner, State Literary Award 2020 (Social Science)');
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'book');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /og\/book-finding-sinhabahu-en\.jpg$/,
    );
  });

  test('live price comes from Firestore', async ({ page }) => {
    await page.goto('books/finding-sinhabahu/');
    await expect(page.locator('[data-book-live] [data-price]').first()).toHaveText(/2,500/);
    await expect(page.locator('[data-book-live] [data-action="order"]').first()).toBeVisible();
  });

  test('launch news post links to the press coverage', async ({ page }) => {
    await page.goto('en/news/book-launch-portuguese-era/');
    await expect(
      page.locator(
        'a[href="https://theleader.lk/news/dr-ajith-amarasinghe-launches-book-on-portuguese-era"]',
      ),
    ).toBeVisible();
  });

  test('feeds, sitemap, robots and manifest are well formed', async ({ request }) => {
    for (const f of ['rss.xml', 'en/rss.xml']) {
      const x = await (await request.get(f)).text();
      expect(x).toContain('<rss');
      expect(x).toContain('book-launch-portuguese-era');
    }
    const sm = await (await request.get('sitemap.xml')).text();
    expect(sm).toContain('/booksbyajith/en/books/finding-sinhabahu/');
    expect(sm).not.toContain('/admin/');
    expect(sm).not.toContain('/order/success/');
    expect(await (await request.get('robots.txt')).text()).toContain('Disallow: /booksbyajith/admin/');
    const m = await (await request.get('manifest.webmanifest')).json();
    expect(m.start_url).toBe('/booksbyajith/');
  });

  test('unknown path shows the 404 page', async ({ page }) => {
    const res = await page.goto('does-not-exist/');
    expect(res?.status()).toBe(404);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('gallery lightbox opens and closes', async ({ page }) => {
    await page.goto('books/portuguese-era-1505-1594/');
    await page.locator('a[data-lightbox-group="samples"]').first().click();
    await expect(page.locator('dialog[data-lightbox]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[data-lightbox]')).toBeHidden();
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
