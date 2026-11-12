import { expect, test } from '@playwright/test';
import { resetAll } from '../helpers/emulator.js';
import { watchConsole } from './helpers.js';

test.beforeEach(async () => {
  await resetAll();
});

const index = (page: import('@playwright/test').Page) =>
  page.locator('[data-slideshow]').getAttribute('data-index').then(Number);

test.describe('home slideshow', () => {
  test('one slide per book; arrows and dots work', async ({ page }) => {
    const con = watchConsole(page);
    await page.goto('');
    const show = page.locator('[data-slideshow]');
    await expect(show.locator('[data-slide]')).toHaveCount(3);
    await show.locator('[data-toggle]').click(); // pause autoplay so the index is deterministic
    await expect(show).toHaveAttribute('data-playing', 'false');
    await show.locator('[data-next]').click();
    await expect(show).toHaveAttribute('data-index', '1');
    await show.locator('[data-dot="2"]').click();
    await expect(show).toHaveAttribute('data-index', '2');
    await expect(show.locator('[data-dot="2"]')).toHaveAttribute('aria-current', 'true');
    await show.locator('[data-next]').click();
    await expect(show).toHaveAttribute('data-index', '0');
    await show.locator('[data-prev]').click();
    await expect(show).toHaveAttribute('data-index', '2');
    con.expectClean();
  });

  test('swiping the track updates the current slide', async ({ page }) => {
    await page.goto('');
    const show = page.locator('[data-slideshow]');
    await show.locator('[data-toggle]').click();
    const swipe = (from: number, to: number) =>
      page.locator('[data-track]').evaluate(
        (el, [f, t]) => {
          const r = el.getBoundingClientRect();
          const y = r.top + r.height / 2;
          const opts = { bubbles: true, pointerType: 'touch', clientY: y };
          el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: r.left + r.width * f }));
          el.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: r.left + r.width * t }));
        },
        [from, to],
      );
    await swipe(0.7, 0.2); // swipe left: next book
    await expect(show).toHaveAttribute('data-index', '1');
    await swipe(0.2, 0.7); // swipe right: previous book
    await expect(show).toHaveAttribute('data-index', '0');
    await swipe(0.5, 0.48); // a tap is not a swipe
    await expect(show).toHaveAttribute('data-index', '0');
  });

  test('autoplay advances on screen, keeps going under the mouse, and stops when paused', async ({
    page,
    isMobile,
  }) => {
    await page.clock.install();
    await page.goto('');
    const show = page.locator('[data-slideshow]');
    await page.mouse.move(0, 0);
    // Autoplay only runs while the carousel is on screen.
    await show.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(show).toHaveAttribute('data-visible', 'true');
    await page.clock.runFor(5200);
    await expect(show).toHaveAttribute('data-index', '1');
    if (!isMobile) {
      await show.hover();
      await page.clock.runFor(5200);
      await expect(show).toHaveAttribute('data-index', '2');
    }
    await show.locator('[data-toggle]').click();
    await expect(show.locator('[data-toggle]')).toHaveAttribute('aria-pressed', 'true');
    const before = await index(page);
    await page.clock.runFor(11000);
    expect(await index(page)).toBe(before);
  });

  test('does not autoplay with reduced motion', async ({ browser }) => {
    const ctx = await browser.newContext({
      reducedMotion: 'reduce',
      baseURL: test.info().project.use.baseURL,
    });
    const page = await ctx.newPage();
    await page.clock.install();
    await page.goto('');
    await page.clock.runFor(12000);
    await expect(page.locator('[data-slideshow]')).toHaveAttribute('data-index', '0');
    await expect(page.locator('[data-slideshow]')).toHaveAttribute('data-playing', 'false');
    await ctx.close();
  });
});

test.describe('home sections', () => {
  test('featured "Order now" links to the order page with the book', async ({ page }) => {
    await page.goto('');
    const a = page.locator('[data-featured-order]');
    await expect(a).toHaveAttribute('href', '/booksbyajith/order/?book=portuguese-era-1505-1594');
  });

  test('story of the week and reels come from config; Facebook loads only on click', async ({ page }) => {
    const fb: string[] = [];
    page.on('request', (r) => r.url().includes('facebook.com') && fb.push(r.url()));
    await page.goto('en/');
    await expect(page.locator('[data-story]')).toBeVisible();
    await expect(page.locator('[data-story-title]')).toHaveText('Story of the week');
    await expect(page.locator('[data-reels] [data-reel-play]')).toHaveCount(1);
    expect(fb).toEqual([]);
    await page.route('https://www.facebook.com/**', (r) => r.fulfill({ status: 200, body: 'ok' }));
    await page.locator('[data-reel-play]').click();
    await expect(page.locator('[data-reels] iframe')).toHaveAttribute(
      'src',
      /facebook\.com\/plugins\/video\.php/,
    );
  });

  test('latest posts and author intro are shown', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#latest-h')).toBeVisible();
    await expect(page.locator('article').filter({ hasText: 'එළිදැක්වේ' }).first()).toBeVisible();
    await expect(page.locator('#author-h')).toBeVisible();
  });
});
