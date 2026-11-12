import { describe, expect, it } from 'vitest';
import {
  adminUpdateRecordSchema,
  createOrderSchema,
  requestStockAlertSchema,
  submitEnquirySchema,
  submitReviewSchema,
  subscribeNewsletterSchema,
  trackOrderSchema,
  updateBookSchema,
  updateOrderStatusSchema,
  updateSettingsSchema,
} from './schemas.js';

export const validOrder = () => ({
  lang: 'si',
  items: [{ slug: 'portuguese-era-1505-1594', qty: 1 }],
  customer: { name: 'Test Customer', mobile: '077 000 0001', whatsapp: '0770000001', email: '' },
  address: {
    line1: '1 Test Road',
    line2: '',
    city: 'Colombo',
    districtId: 'colombo',
    postalCode: '00100',
    landmark: '',
  },
  geo: null,
  signedCopy: false,
  dedicationNote: '',
  expectedTotalLKR: 4850,
  slip: { fileName: 'slip.jpg', contentType: 'image/jpeg', dataBase64: '/9j/4AAQSkZJRgABAQ' },
  consent: true,
});

describe('createOrderSchema', () => {
  it('accepts and normalises a valid order', () => {
    const r = createOrderSchema.parse(validOrder());
    expect(r.customer.mobile).toBe('94770000001');
    expect(r.customer.email).toBeUndefined();
    expect(r.address.line2).toBeUndefined();
  });
  it.each([
    ['bad mobile', (o: any) => (o.customer.mobile = '0112345678')],
    ['bad district', (o: any) => (o.address.districtId = 'atlantis')],
    ['bad postcode', (o: any) => (o.address.postalCode = '123')],
    ['no consent', (o: any) => (o.consent = false)],
    ['empty cart', (o: any) => (o.items = [])],
    [
      'duplicate slug',
      (o: any) =>
        (o.items = [
          { slug: 'a', qty: 1 },
          { slug: 'a', qty: 2 },
        ]),
    ],
    ['qty too large', (o: any) => (o.items = [{ slug: 'a', qty: 21 }])],
    ['bad email', (o: any) => (o.customer.email = 'nope')],
    ['short name', (o: any) => (o.customer.name = 'A')],
    ['long dedication', (o: any) => (o.dedicationNote = 'x'.repeat(301))],
    ['bad geo', (o: any) => (o.geo = { lat: 100, lng: 0, accuracyM: 5, capturedAt: 1 })],
  ])('rejects %s', (_n, mutate) => {
    const o = validOrder();
    mutate(o);
    expect(createOrderSchema.safeParse(o).success).toBe(false);
  });
  it('accepts geo', () => {
    const o = { ...validOrder(), geo: { lat: 6.9, lng: 79.8, accuracyM: 12, capturedAt: Date.now() } };
    expect(createOrderSchema.safeParse(o).success).toBe(true);
  });
});

describe('trackOrderSchema', () => {
  it('uppercases the order id', () =>
    expect(trackOrderSchema.parse({ orderId: 'aj-2611-7k3q', phoneLast4: '0001' }).orderId).toBe(
      'AJ-2611-7K3Q',
    ));
  it('rejects ambiguous letters', () =>
    expect(trackOrderSchema.safeParse({ orderId: 'AJ-2611-7K3O', phoneLast4: '0001' }).success).toBe(false));
  it('rejects bad digits', () =>
    expect(trackOrderSchema.safeParse({ orderId: 'AJ-2611-7K3Q', phoneLast4: '12a4' }).success).toBe(false));
});

describe('admin schemas', () => {
  it('updateOrderStatus', () => {
    expect(
      updateOrderStatusSchema.safeParse({
        orderId: 'AJ-2611-7K3Q',
        to: 'dispatched',
        courier: 'X',
        trackingNo: '1',
      }).success,
    ).toBe(true);
    expect(updateOrderStatusSchema.safeParse({ orderId: 'AJ-2611-7K3Q', to: 'shipped' }).success).toBe(false);
  });
  it('updateSettings accepts partial public config', () => {
    const r = updateSettingsSchema.safeParse({
      public: {
        contact: {
          whatsappNumber: '0770000001',
          orderPhone: '',
          facebookPageUrl: 'https://facebook.com/example',
        },
      },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.public?.contact?.whatsappNumber).toBe('94770000001');
  });
  it('updateSettings rejects unknown keys', () => {
    expect(updateSettingsSchema.safeParse({ public: { evil: 1 } }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ other: {} }).success).toBe(false);
  });
  it('updateSettings rejects http urls', () => {
    expect(
      updateSettingsSchema.safeParse({
        public: { contact: { whatsappNumber: '', orderPhone: '', facebookPageUrl: 'http://facebook.com/x' } },
      }).success,
    ).toBe(false);
  });
  it('updateSettings rejects bad district keys', () => {
    expect(
      updateSettingsSchema.safeParse({
        public: {
          delivery: {
            fees: { mars: 100 },
            defaultFeeLKR: 1,
            perExtraCopyLKR: 0,
            estimateDays: { min: 1, max: 2 },
          },
        },
      }).success,
    ).toBe(false);
  });
  it('updateSettings rejects empty', () => expect(updateSettingsSchema.safeParse({}).success).toBe(false));
  it('updateBook', () => {
    expect(updateBookSchema.safeParse({ slug: 'a', priceLKR: 100 }).success).toBe(true);
    expect(updateBookSchema.safeParse({ slug: 'a', priceLKR: -1 }).success).toBe(false);
    expect(updateBookSchema.safeParse({ slug: 'a', externalUrl: 'http://x.y' }).success).toBe(false);
  });
  it('adminUpdateRecord valid pairs only', () => {
    expect(
      adminUpdateRecordSchema.safeParse({ collection: 'stock_alerts', id: 'x', action: 'mark_notified' })
        .success,
    ).toBe(true);
    expect(
      adminUpdateRecordSchema.safeParse({ collection: 'enquiries', id: 'x', action: 'mark_notified' })
        .success,
    ).toBe(false);
    expect(
      adminUpdateRecordSchema.safeParse({ collection: 'newsletter_subscribers', id: 'x', action: 'delete' })
        .success,
    ).toBe(true);
  });
});

describe('engagement schemas', () => {
  it('newsletter', () => {
    expect(
      subscribeNewsletterSchema.parse({ email: ' A@Example.com ', lang: 'en', consent: true, source: 'home' })
        .email,
    ).toBe('a@example.com');
    expect(
      subscribeNewsletterSchema.safeParse({
        email: 'a@example.com',
        lang: 'en',
        consent: false,
        source: 'home',
      }).success,
    ).toBe(false);
  });
  it('stock alert needs a contact', () => {
    expect(requestStockAlertSchema.safeParse({ slug: 'a', lang: 'si', consent: true }).success).toBe(false);
    expect(
      requestStockAlertSchema.safeParse({ slug: 'a', lang: 'si', whatsapp: '0770000001', consent: true })
        .success,
    ).toBe(true);
  });
  it('enquiry', () => {
    expect(
      submitEnquirySchema.safeParse({
        kind: 'library',
        organisation: 'Test Library',
        contactName: 'Test Person',
        phone: '0770000001',
        books: [{ slug: 'a', qty: 20 }],
        lang: 'en',
        consent: true,
      }).success,
    ).toBe(true);
  });
  it('review', () => {
    expect(
      submitReviewSchema.safeParse({
        slug: 'a',
        displayName: 'Reader',
        rating: 5,
        text: 'A wonderful book.',
        lang: 'en',
        consent: true,
      }).success,
    ).toBe(true);
    expect(
      submitReviewSchema.safeParse({
        slug: 'a',
        displayName: 'Reader',
        rating: 6,
        text: 'A wonderful book.',
        lang: 'en',
        consent: true,
      }).success,
    ).toBe(false);
  });
});
