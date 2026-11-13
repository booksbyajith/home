import { Timestamp } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import { setAdmin } from '../../scripts/grant-admin.mjs';
import {
  adminAuth,
  adminToken,
  bucket,
  call,
  db,
  outbox,
  resetAll,
  signIn,
  userToken,
} from '../helpers/emulator.js';
import { CHINESE, orderInput } from '../helpers/fixtures.js';
import { pdf } from '../helpers/files.js';

let admin: string;
beforeEach(async () => {
  await resetAll();
  admin = await adminToken();
});

describe('getSlipUrl', () => {
  it('returns the slip to admins only and logs the view', async () => {
    const orderId = (await call('createOrder', await orderInput())).result.orderId;
    const r = await call('getSlipUrl', { orderId }, { idToken: admin });
    expect(r.error).toBeUndefined();
    expect(r.result.url.startsWith('data:image/jpeg;base64,/9j/')).toBe(true);
    expect(r.result.contentType).toBe('image/jpeg');
    const views = await db.collection(`orders/${orderId}/audit`).where('type', '==', 'slip_view').get();
    expect(views.size).toBe(1);
    expect((await call('getSlipUrl', { orderId }, { idToken: await userToken() })).error?.status).toBe(
      'PERMISSION_DENIED',
    );
    expect((await call('getSlipUrl', { orderId })).error?.status).toBe('PERMISSION_DENIED');
  });
});

describe('getSlipUrl with a PDF slip', () => {
  it('returns the PDF itself', async () => {
    const file = pdf(300_000);
    const input = await orderInput({
      slip: {
        fileName: 'HNB_Transfer_Receipt.pdf',
        contentType: 'application/pdf',
        dataBase64: file.toString('base64'),
      },
    });
    const orderId = (await call('createOrder', input)).result.orderId;
    const r = await call('getSlipUrl', { orderId }, { idToken: admin });
    expect(r.error).toBeUndefined();
    expect(r.result.contentType).toBe('application/pdf');
    expect(r.result.url.startsWith('data:application/pdf;base64,JVBER')).toBe(true);
  });
});

describe('addOrderNote', () => {
  it('adds an internal note', async () => {
    const orderId = (await call('createOrder', await orderInput())).result.orderId;
    expect(
      (await call('addOrderNote', { orderId, note: 'Called the customer' }, { idToken: admin })).result,
    ).toEqual({ ok: true });
    const notes = await db.collection(`orders/${orderId}/audit`).where('type', '==', 'note').get();
    expect(notes.docs[0].get('note')).toBe('Called the customer');
  });
});

describe('updateSettings', () => {
  it('replaces whole top-level fields and stamps the editor', async () => {
    const r = await call(
      'updateSettings',
      {
        public: {
          delivery: {
            fees: { kandy: 500 },
            defaultFeeLKR: 400,
            perExtraCopyLKR: 50,
            estimateDays: { min: 1, max: 3 },
          },
          contact: {
            whatsappNumber: '0770000009',
            orderPhone: '0112345670',
            facebookPageUrl: 'https://www.facebook.com/example2',
          },
        },
        private: { lowStockThreshold: 3 },
      },
      { idToken: admin },
    );
    expect(r.error).toBeUndefined();
    const pub = (await db.doc('config/public').get()).data()!;
    expect(pub.delivery.fees).toEqual({ kandy: 500 });
    expect(pub.contact.whatsappNumber).toBe('94770000009');
    expect(pub.bank.accountNumber).toBe('000000000000');
    expect(pub.updatedBy).toBeTruthy();
    expect((await db.doc('config/private').get()).get('lowStockThreshold')).toBe(3);
  });
  it('rejects unknown keys, http URLs and bad districts', async () => {
    for (const data of [
      { public: { evil: true } },
      {
        public: { contact: { whatsappNumber: '', orderPhone: '', facebookPageUrl: 'http://x.example.com' } },
      },
      {
        public: {
          delivery: {
            fees: { mars: 1 },
            defaultFeeLKR: 1,
            perExtraCopyLKR: 0,
            estimateDays: { min: 1, max: 2 },
          },
        },
      },
    ]) {
      expect((await call('updateSettings', data, { idToken: admin })).error?.details?.code).toBe(
        'VALIDATION',
      );
    }
  });
  it('is admin-only', async () => {
    expect(
      (await call('updateSettings', { private: { lowStockThreshold: 1 } }, { idToken: await userToken() }))
        .error?.status,
    ).toBe('PERMISSION_DENIED');
  });
});

describe('updateBook', () => {
  it('updates price and stock', async () => {
    expect(
      (await call('updateBook', { slug: CHINESE, priceLKR: 2000, stock: 5 }, { idToken: admin })).result.ok,
    ).toBe(true);
    expect((await db.doc(`books/${CHINESE}`).get()).data()).toMatchObject({ priceLKR: 2000, stock: 5 });
  });
  it('rejects direct sale at price 0 and external without URL', async () => {
    expect(
      (await call('updateBook', { slug: CHINESE, priceLKR: 0 }, { idToken: admin })).error?.details?.fields,
    ).toEqual(['priceLKR']);
    expect(
      (await call('updateBook', { slug: CHINESE, saleMode: 'external' }, { idToken: admin })).error?.details
        ?.fields,
    ).toEqual(['externalUrl']);
    expect(
      (
        await call(
          'updateBook',
          { slug: CHINESE, saleMode: 'external', externalUrl: 'https://shop.example.com/b' },
          { idToken: admin },
        )
      ).result.ok,
    ).toBe(true);
  });
  it('emails pending stock alerts when a book becomes orderable', async () => {
    await db.doc(`books/${CHINESE}`).update({ inStock: false, stock: 0 });
    await db.doc('stock_alerts/a1').set({
      slug: CHINESE,
      contact: { email: 'wait@example.com', whatsapp: null },
      lang: 'en',
      createdAt: Timestamp.now(),
      notifiedAt: null,
    });
    await db.doc('stock_alerts/a2').set({
      slug: CHINESE,
      contact: { email: null, whatsapp: '94770000005' },
      lang: 'si',
      createdAt: Timestamp.now(),
      notifiedAt: null,
    });
    const r = await call('updateBook', { slug: CHINESE, inStock: true, stock: 10 }, { idToken: admin });
    expect(r.result).toEqual({ ok: true, alertsEmailed: 1 });
    const mail = (await outbox((d) => d.meta?.event === 'back_in_stock'))[0];
    expect(mail.to).toEqual(['wait@example.com']);
    expect(mail.text).toContain('/en/order/?book=chinese-expedition');
    expect((await db.doc('stock_alerts/a1').get()).get('notifiedAt')).toBeTruthy();
    expect((await db.doc('stock_alerts/a2').get()).get('notifiedAt')).toBeNull();
    // Already orderable: no second email.
    expect(
      (await call('updateBook', { slug: CHINESE, stock: 11 }, { idToken: admin })).result.alertsEmailed,
    ).toBe(0);
  });

  it('rejects unknown books', async () => {
    expect((await call('updateBook', { slug: 'nope', stock: 1 }, { idToken: admin })).error?.status).toBe(
      'NOT_FOUND',
    );
  });
});

describe('moderateReview', () => {
  it('publishes and unpublishes a review', async () => {
    await db.doc('review_submissions/r1').set({
      slug: CHINESE,
      displayName: 'Reader',
      rating: 5,
      text: 'Excellent research.',
      lang: 'en',
      status: 'pending',
      createdAt: Timestamp.now(),
    });
    await call('moderateReview', { id: 'r1', action: 'approve' }, { idToken: admin });
    const pub = await db.doc(`books/${CHINESE}/reviews/r1`).get();
    expect(pub.data()).toMatchObject({ displayName: 'Reader', rating: 5, text: 'Excellent research.' });
    expect(Object.keys(pub.data()!).sort()).toEqual(['approvedAt', 'displayName', 'lang', 'rating', 'text']);
    expect((await db.doc('review_submissions/r1').get()).get('status')).toBe('approved');
    await call('moderateReview', { id: 'r1', action: 'unpublish' }, { idToken: admin });
    expect((await db.doc(`books/${CHINESE}/reviews/r1`).get()).exists).toBe(false);
  });
});

describe('adminUpdateRecord', () => {
  it('marks and deletes records', async () => {
    await db.doc('stock_alerts/a1').set({ slug: CHINESE, notifiedAt: null });
    await db.doc('enquiries/e1').set({ handledAt: null });
    await call(
      'adminUpdateRecord',
      { collection: 'stock_alerts', id: 'a1', action: 'mark_notified' },
      { idToken: admin },
    );
    await call(
      'adminUpdateRecord',
      { collection: 'enquiries', id: 'e1', action: 'mark_handled' },
      { idToken: admin },
    );
    expect((await db.doc('stock_alerts/a1').get()).get('notifiedAt')).toBeTruthy();
    expect((await db.doc('enquiries/e1').get()).get('handledAt')).toBeTruthy();
    expect(
      (
        await call(
          'adminUpdateRecord',
          { collection: 'enquiries', id: 'e1', action: 'mark_notified' },
          { idToken: admin },
        )
      ).error?.details?.code,
    ).toBe('VALIDATION');
    await call(
      'adminUpdateRecord',
      { collection: 'enquiries', id: 'e1', action: 'delete' },
      { idToken: admin },
    );
    expect((await db.doc('enquiries/e1').get()).exists).toBe(false);
  });
});

describe('anonymiseOldOrders', () => {
  it('previews, then clears personal data while tracking still works', async () => {
    const oldId = (await call('createOrder', await orderInput())).result.orderId;
    const recentId = (await call('createOrder', await orderInput())).result.orderId;
    const openId = (await call('createOrder', await orderInput())).result.orderId;
    await call('addOrderNote', { orderId: oldId, note: 'private note' }, { idToken: admin });
    const longAgo = Timestamp.fromDate(new Date(Date.now() - 400 * 86400 * 1000));
    await db.doc(`orders/${oldId}`).update({ status: 'delivered', closedAt: longAgo });
    await db.doc(`orders/${recentId}`).update({ status: 'delivered', closedAt: Timestamp.now() });
    const slipPath = (await db.doc(`orders/${oldId}`).get()).get('slip.path');

    const dry = await call('anonymiseOldOrders', { dryRun: true }, { idToken: admin });
    expect(dry.result).toMatchObject({ matched: 1, anonymised: 0, hasMore: false });
    expect((await db.doc(`orders/${oldId}`).get()).get('customer.name')).toBe('Test Customer');

    const run = await call('anonymiseOldOrders', { dryRun: false }, { idToken: admin });
    expect(run.result).toMatchObject({ matched: 1, anonymised: 1 });
    const o = (await db.doc(`orders/${oldId}`).get()).data()!;
    expect(o.customer).toEqual({ name: '[removed]', mobile: '', whatsapp: '', email: null });
    expect(o.address).toEqual({
      line1: '',
      line2: null,
      city: '',
      districtId: 'colombo',
      postalCode: '',
      country: null, // kept for overseas orders (accounts), empty here
      landmark: null,
    });
    expect(o.slip).toBeNull();
    expect(o.search).toEqual([oldId]);
    expect(o.anonymisedAt).toBeTruthy();
    expect((await bucket.file(slipPath).exists())[0]).toBe(false);
    expect((await db.collection(`orders/${oldId}/audit`).where('type', '==', 'note').get()).size).toBe(0);
    expect((await db.collection(`orders/${oldId}/audit`).where('type', '==', 'anonymise').get()).size).toBe(
      1,
    );
    expect(JSON.stringify(o)).not.toContain('94770000001');

    expect((await call('trackOrder', { orderId: oldId, phoneLast4: '0001' })).result.status).toBe(
      'delivered',
    );
    expect((await db.doc(`orders/${recentId}`).get()).get('customer.name')).toBe('Test Customer');
    expect((await db.doc(`orders/${openId}`).get()).get('customer.name')).toBe('Test Customer');
  });
});

describe('grant-admin script', () => {
  it('grants and revokes the claim', async () => {
    await adminAuth.createUser({ email: 'staff@example.com', password: 'password-123' });
    await setAdmin(adminAuth, 'staff@example.com', true);
    let token = await signIn('staff@example.com', 'password-123');
    expect(
      (await call('addOrderNote', { orderId: 'AJ-2611-2222', note: 'x' }, { idToken: token })).error?.status,
    ).toBe('NOT_FOUND');
    await setAdmin(adminAuth, 'staff@example.com', false);
    token = await signIn('staff@example.com', 'password-123');
    expect(
      (await call('addOrderNote', { orderId: 'AJ-2611-2222', note: 'x' }, { idToken: token })).error?.status,
    ).toBe('PERMISSION_DENIED');
    await expect(setAdmin(adminAuth, 'nobody@example.com', true)).rejects.toThrow('sign in once');
  });
});
