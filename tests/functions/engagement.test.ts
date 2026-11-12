import { beforeEach, describe, expect, it } from 'vitest';
import { call, db, outbox, resetAll, waitFor } from '../helpers/emulator.js';
import { CHINESE } from '../helpers/fixtures.js';

beforeEach(resetAll);

describe('newsletter', () => {
  it('subscribe is idempotent and unsubscribe works', async () => {
    const data = { email: 'Reader@Example.com', lang: 'en', consent: true, source: 'home' };
    expect((await call('subscribeNewsletter', data)).result).toEqual({ ok: true });
    expect((await call('subscribeNewsletter', data)).result).toEqual({ ok: true });
    const snap = await db.collection('newsletter_subscribers').get();
    expect(snap.size).toBe(1);
    const sub = snap.docs[0];
    expect(sub.id).toMatch(/^[0-9a-f]{64}$/);
    expect(sub.get('email')).toBe('reader@example.com');
    expect(sub.get('consentText')).toContain('unsubscribe');
    const token = sub.get('unsubToken');
    expect((await call('unsubscribeNewsletter', { token })).result).toEqual({ ok: true });
    expect((await sub.ref.get()).get('unsubscribedAt')).toBeTruthy();
    // Unknown tokens give the same answer.
    expect((await call('unsubscribeNewsletter', { token: 'x'.repeat(43) })).result).toEqual({ ok: true });
  });
  it('requires consent', async () => {
    expect(
      (
        await call('subscribeNewsletter', {
          email: 'a@example.com',
          lang: 'en',
          consent: false,
          source: 'home',
        })
      ).error?.details?.code,
    ).toBe('VALIDATION');
  });
});

describe('stock alerts', () => {
  it('needs at least one contact and a real book', async () => {
    expect(
      (await call('requestStockAlert', { slug: CHINESE, lang: 'si', consent: true })).error?.details?.code,
    ).toBe('VALIDATION');
    expect(
      (await call('requestStockAlert', { slug: 'nope', lang: 'si', whatsapp: '0770000006', consent: true }))
        .error?.status,
    ).toBe('NOT_FOUND');
    expect(
      (await call('requestStockAlert', { slug: CHINESE, lang: 'si', whatsapp: '0770000006', consent: true }))
        .result,
    ).toEqual({ ok: true });
    const a = (await db.collection('stock_alerts').get()).docs[0].data();
    expect(a).toMatchObject({
      slug: CHINESE,
      contact: { whatsapp: '94770000006', email: null },
      notifiedAt: null,
    });
  });
});

describe('enquiries', () => {
  it('stores the enquiry and queues a team email', async () => {
    const r = await call('submitEnquiry', {
      kind: 'library',
      organisation: 'Test Public Library',
      contactName: 'Test Librarian',
      phone: '0770000007',
      email: 'library@example.com',
      books: [{ slug: 'finding-sinhabahu', qty: 25 }],
      message: 'For our reference section.',
      lang: 'en',
      consent: true,
    });
    expect(r.result).toEqual({ ok: true });
    const e = (await db.collection('enquiries').get()).docs[0].data();
    expect(e).toMatchObject({ kind: 'library', phone: '94770000007', handledAt: null });
    const mail = await waitFor(async () => (await outbox((d) => d.meta?.event === 'enquiry'))[0]);
    expect(mail.subject).toContain('Test Public Library');
    expect(mail.to).toEqual(['team@example.com', 'team2@example.com']);
  });
});

describe('reviews', () => {
  it('stores submissions as pending, not public', async () => {
    const r = await call('submitReview', {
      slug: CHINESE,
      displayName: 'Reader',
      rating: 4,
      text: 'Very well researched.',
      lang: 'en',
      consent: true,
    });
    expect(r.result).toEqual({ ok: true });
    expect((await db.collection('review_submissions').get()).docs[0].get('status')).toBe('pending');
    expect((await db.collection(`books/${CHINESE}/reviews`).get()).size).toBe(0);
  });
});

describe('rate limits', () => {
  it('blocks the sixth call from one IP in an hour', async () => {
    for (let i = 0; i < 5; i++)
      expect(
        (
          await call('subscribeNewsletter', {
            email: `r${i}@example.com`,
            lang: 'en',
            consent: true,
            source: 'home',
          })
        ).error,
      ).toBeUndefined();
    const r = await call('subscribeNewsletter', {
      email: 'r9@example.com',
      lang: 'en',
      consent: true,
      source: 'home',
    });
    expect(r.error?.details?.code).toBe('RATE_LIMITED');
  });
  it('requires App Check', async () => {
    expect(
      (
        await call(
          'submitReview',
          {
            slug: CHINESE,
            displayName: 'Reader',
            rating: 4,
            text: 'Very well researched.',
            lang: 'en',
            consent: true,
          },
          { appCheck: false },
        )
      ).error?.status,
    ).toBe('UNAUTHENTICATED');
  });
});
