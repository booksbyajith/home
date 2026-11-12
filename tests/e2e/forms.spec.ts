import { expect, test } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { db, resetAll, waitFor } from '../helpers/emulator.js';

test.beforeEach(async () => {
  await resetAll();
});

const count = async (c: string) => (await db.collection(c).get()).size;

test('newsletter signup on the home page stores a consented subscriber', async ({ page }) => {
  await page.goto('en/');
  await page.locator('main [data-form="newsletter"]').scrollIntoViewIfNeeded();
  const form = page.locator('main [data-form="newsletter"][data-hydrated="true"]');
  await form.locator('input[type=email]').fill('reader@example.com');
  await expect(form.locator('button[type=submit]')).toBeDisabled();
  await form.locator('input[type=checkbox]').check();
  await form.locator('button[type=submit]').click();
  await expect(page.locator('main [data-form-done="newsletter"]')).toBeVisible();
  const sub = (await db.collection('newsletter_subscribers').get()).docs[0].data();
  expect(sub).toMatchObject({
    email: 'reader@example.com',
    lang: 'en',
    source: 'home',
    unsubscribedAt: null,
  });
});

test('notify-me form appears for an out-of-stock book and stores an alert', async ({ page }) => {
  await page.goto('books/chinese-expedition/');
  const notify = page.locator('[data-action="notify"]');
  await expect(notify).toBeVisible();
  await notify.scrollIntoViewIfNeeded();
  await expect(notify.locator('[data-hydrated="true"]')).toBeVisible();
  await expect(page.locator('[data-action="order"]')).toBeHidden();
  await notify.locator('input[type=tel]').fill('0770000009');
  await notify.locator('input[type=checkbox]').check();
  await notify.locator('button[type=submit]').click();
  await expect(page.locator('[data-form-done="stock-alert"]')).toBeVisible();
  expect((await db.collection('stock_alerts').get()).docs[0].data()).toMatchObject({
    slug: 'chinese-expedition',
    contact: { whatsapp: '94770000009', email: null },
  });
});

test('bulk enquiry is stored', async ({ page }) => {
  await page.goto('en/bulk-orders/');
  const f = page.locator('[data-form="enquiry"][data-hydrated="true"]');
  await f.locator('#enq-kind').selectOption('library');
  await f.locator('#enq-org').fill('Test Public Library');
  await f.locator('#enq-name').fill('Test Librarian');
  await f.locator('#enq-phone').fill('0770000007');
  await f.locator('#enq-q-finding-sinhabahu').fill('25');
  await f.locator('#enq-consent').check();
  await f.locator('button[type=submit]').click();
  await expect(page.locator('[data-form-done="enquiry"]')).toBeVisible();
  expect((await db.collection('enquiries').get()).docs[0].data()).toMatchObject({
    kind: 'library',
    organisation: 'Test Public Library',
    books: [{ slug: 'finding-sinhabahu', qty: 25 }],
  });
});

test('reader review is stored for moderation; approved reviews are listed', async ({ page }) => {
  await db.doc('books/finding-sinhabahu/reviews/r1').set({
    displayName: 'Approved Reader',
    rating: 4,
    text: 'A careful and convincing study.',
    lang: 'en',
    approvedAt: Timestamp.now(),
  });
  await page.goto('en/books/finding-sinhabahu/');
  await page.locator('[data-reviews]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-reviews-list] li')).toHaveCount(1);
  await expect(page.locator('[data-reviews-list]')).toContainText('Approved Reader');
  await page.getByText('Write a review').click();
  const f = page.locator('[data-form="review"][data-hydrated="true"]');
  await f.locator('input[id^="rv-n-"]').fill('New Reader');
  await f.locator('textarea').fill('I learned a great deal from this book.');
  await f.locator('input[type=checkbox]').check();
  await f.locator('button[type=submit]').click();
  await expect(page.locator('[data-form-done="review"]')).toBeVisible();
  const sub = (await db.collection('review_submissions').get()).docs[0].data();
  expect(sub).toMatchObject({ slug: 'finding-sinhabahu', displayName: 'New Reader', status: 'pending' });
  expect((await db.collection('books/finding-sinhabahu/reviews').get()).size).toBe(1);
});

test('the honeypot silently drops bot submissions', async ({ page }) => {
  await page.goto('en/');
  await page.locator('main [data-form="newsletter"]').scrollIntoViewIfNeeded();
  const form = page.locator('main [data-form="newsletter"][data-hydrated="true"]');
  await form.locator('input[name="website"]').evaluate((el: HTMLInputElement) => {
    el.value = 'spam';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await form.locator('input[type=email]').fill('bot@example.com');
  await form.locator('input[type=checkbox]').check();
  await form.locator('button[type=submit]').click();
  await expect(page.locator('main [data-form-done="newsletter"]')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await count('newsletter_subscribers')).toBe(0);
});

test('unsubscribe page uses the token in the fragment', async ({ page }) => {
  await db
    .doc('newsletter_subscribers/x')
    .set({ email: 'a@example.com', unsubToken: 'tok_abcdefghijklmnopqrstuvwxyz', unsubscribedAt: null });
  await page.goto('en/newsletter/unsubscribe/#tok_abcdefghijklmnopqrstuvwxyz');
  await expect(page.locator('[data-unsub="done"]')).toBeVisible();
  expect(page.url()).not.toContain('tok_');
  await waitFor(async () => (await db.doc('newsletter_subscribers/x').get()).get('unsubscribedAt'));
});
