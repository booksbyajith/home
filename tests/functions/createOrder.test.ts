import { beforeEach, describe, expect, it } from 'vitest';
import { bucket, call, db, resetAll } from '../helpers/emulator.js';
import { pdf, png, webp } from '../helpers/files.js';
import { CHINESE, PORTUGUESE, SINHABAHU, orderInput } from '../helpers/fixtures.js';

beforeEach(resetAll);

describe('createOrder', () => {
  it('creates an order, stores the slip, reserves stock and writes an audit event', async () => {
    const r = await call('createOrder', await orderInput());
    expect(r.error).toBeUndefined();
    const out = r.result;
    expect(out.orderId).toMatch(/^AJ-\d{4}-[2-9A-HJKMNP-TV-Z]{4}$/);
    expect(out.status).toBe('pending_verification');
    expect(out.totals).toEqual({
      subtotalLKR: 4500,
      bundleDiscountLKR: 0,
      signedSurchargeLKR: 0,
      deliveryFeeLKR: 350,
      grandTotalLKR: 4850,
    });
    expect(out.phoneMasked).toBe('••• ••• 0001');
    expect(out.totalMismatch).toBe(false);
    expect(Object.keys(out).sort()).toEqual(
      ['createdAt', 'items', 'orderId', 'phoneMasked', 'status', 'totalMismatch', 'totals'].sort(),
    );

    const order = (await db.doc(`orders/${out.orderId}`).get()).data()!;
    expect(order.customer).toEqual({
      name: 'Test Customer',
      mobile: '94770000001',
      whatsapp: '94770000001',
      email: 'customer@example.com',
    });
    expect(order.phoneLast4).toBe('0001');
    expect(order.lang).toBe('si');
    expect(order.statusHistory).toHaveLength(1);
    expect(order.stockReserved).toBe(true);
    expect(order.search).toContain(out.orderId);
    expect(order.search).toContain('0001');
    expect(order.slip.path).toBe(`slips/${out.orderId}/slip.jpg`);
    const [exists] = await bucket.file(order.slip.path).exists();
    expect(exists).toBe(true);

    expect((await db.doc(`books/${PORTUGUESE}`).get()).get('stock')).toBe(99);
    const audit = await db.collection(`orders/${out.orderId}/audit`).get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].data()).toMatchObject({
      type: 'status',
      from: null,
      to: 'pending_verification',
      by: null,
    });
  });

  it('recomputes totals server-side and flags a mismatch', async () => {
    const r = await call(
      'createOrder',
      await orderInput({
        items: [
          { slug: PORTUGUESE, qty: 1 },
          { slug: SINHABAHU, qty: 2 },
        ],
        address: { line1: '1 Road', city: 'Kandy', districtId: 'kandy', postalCode: '20000' },
        signedCopy: true,
        expectedTotalLKR: 1,
      }),
    );
    expect(r.error).toBeUndefined();
    // subtotal 9500, bundle 10% = 950, signed 3 x 500 = 1500, delivery 450 + 2 x 100 = 650
    expect(r.result.totals).toEqual({
      subtotalLKR: 9500,
      bundleDiscountLKR: 950,
      signedSurchargeLKR: 1500,
      deliveryFeeLKR: 650,
      grandTotalLKR: 10700,
    });
    expect(r.result.totalMismatch).toBe(true);
    const order = (await db.doc(`orders/${r.result.orderId}`).get()).data()!;
    expect(order.totals.grandTotalLKR).toBe(10700);
    expect(order.clientExpectedTotalLKR).toBe(1);
  });

  it('stores geolocation', async () => {
    const capturedAt = Date.now();
    const r = await call(
      'createOrder',
      await orderInput({ geo: { lat: 6.9271, lng: 79.8612, accuracyM: 15, capturedAt } }),
    );
    const order = (await db.doc(`orders/${r.result.orderId}`).get()).data()!;
    expect(order.geo.lat).toBe(6.9271);
    expect(order.geo.lng).toBe(79.8612);
    expect(order.geo.capturedAt.toMillis()).toBe(capturedAt);
  });

  const expectError = (r: any, status: string, code: string) => {
    expect(r.result).toBeUndefined();
    expect(r.error?.status).toBe(status);
    expect(r.error?.details?.code).toBe(code);
  };

  it('rejects unknown books', async () => {
    expectError(
      await call('createOrder', await orderInput({ items: [{ slug: 'no-such-book', qty: 1 }] })),
      'FAILED_PRECONDITION',
      'BOOK_UNAVAILABLE',
    );
  });

  it('rejects external and unavailable books', async () => {
    await db
      .doc(`books/${SINHABAHU}`)
      .update({ saleMode: 'external', externalUrl: 'https://shop.example.com' });
    expectError(
      await call('createOrder', await orderInput({ items: [{ slug: SINHABAHU, qty: 1 }] })),
      'FAILED_PRECONDITION',
      'BOOK_UNAVAILABLE',
    );
    await db.doc(`books/${SINHABAHU}`).update({ saleMode: 'unavailable' });
    expectError(
      await call('createOrder', await orderInput({ items: [{ slug: SINHABAHU, qty: 1 }] })),
      'FAILED_PRECONDITION',
      'BOOK_UNAVAILABLE',
    );
  });

  it('rejects zero-price books', async () => {
    await db.doc(`books/${SINHABAHU}`).update({ priceLKR: 0 });
    const r = await call('createOrder', await orderInput({ items: [{ slug: SINHABAHU, qty: 1 }] }));
    expectError(r, 'FAILED_PRECONDITION', 'BOOK_UNAVAILABLE');
    expect(r.error?.details?.slugs).toEqual([SINHABAHU]);
  });

  it('rejects out-of-stock books and does not leave a slip behind', async () => {
    const r = await call('createOrder', await orderInput({ items: [{ slug: CHINESE, qty: 1 }] }));
    expectError(r, 'FAILED_PRECONDITION', 'OUT_OF_STOCK');
    const [files] = await bucket.getFiles({ prefix: 'slips/' });
    expect(files).toHaveLength(0);
    expect((await db.collection('orders').get()).size).toBe(0);
  });

  it('accepts a pre-order with zero stock and does not decrement stock', async () => {
    await db.doc(`books/${CHINESE}`).update({ preorder: true });
    const r = await call('createOrder', await orderInput({ items: [{ slug: CHINESE, qty: 2 }] }));
    expect(r.error).toBeUndefined();
    expect(r.result.items[0].preorder).toBe(true);
    expect((await db.doc(`books/${CHINESE}`).get()).get('stock')).toBe(0);
  });

  it('rejects when orders are closed or bank details are empty', async () => {
    await db.doc('config/public').update({ ordersOpen: false });
    expectError(await call('createOrder', await orderInput()), 'FAILED_PRECONDITION', 'ORDERS_CLOSED');
    await db.doc('config/public').update({ ordersOpen: true, 'bank.accountNumber': '' });
    expectError(await call('createOrder', await orderInput()), 'FAILED_PRECONDITION', 'ORDERS_CLOSED');
  });

  it('rejects an oversize slip', async () => {
    const big = pdf(5 * 1024 * 1024 + 10);
    const r = await call(
      'createOrder',
      await orderInput({
        slip: { fileName: 's.pdf', contentType: 'application/pdf', dataBase64: big.toString('base64') },
      }),
    );
    expect(r.error?.status).toBe('INVALID_ARGUMENT');
    expect(['SLIP_TOO_LARGE', 'VALIDATION']).toContain(r.error?.details?.code);
  });

  it('accepts a 4.5 MB PDF', async () => {
    const r = await call(
      'createOrder',
      await orderInput({
        slip: {
          fileName: 's.pdf',
          contentType: 'application/pdf',
          dataBase64: pdf(4.5 * 1024 * 1024).toString('base64'),
        },
      }),
    );
    expect(r.error).toBeUndefined();
    const order = (await db.doc(`orders/${r.result.orderId}`).get()).data()!;
    expect(order.slip.contentType).toBe('application/pdf');
    expect(order.slip.path.endsWith('.pdf')).toBe(true);
  });

  it('accepts PNG and WebP slips', async () => {
    for (const [type, buf] of [
      ['image/png', await png()],
      ['image/webp', await webp()],
    ] as const) {
      await resetAll();
      const r = await call(
        'createOrder',
        await orderInput({ slip: { fileName: 'x', contentType: type, dataBase64: buf.toString('base64') } }),
      );
      expect(r.error).toBeUndefined();
    }
  });

  it('rejects a slip whose bytes do not match its type', async () => {
    const r = await call(
      'createOrder',
      await orderInput({
        slip: {
          fileName: 'x.jpg',
          contentType: 'image/jpeg',
          dataBase64: Buffer.from('hello world, not an image').toString('base64'),
        },
      }),
    );
    expectError(r, 'INVALID_ARGUMENT', 'SLIP_INVALID');
    const p = await png();
    expectError(
      await call(
        'createOrder',
        await orderInput({
          slip: { fileName: 'x.jpg', contentType: 'image/jpeg', dataBase64: p.toString('base64') },
        }),
      ),
      'INVALID_ARGUMENT',
      'SLIP_INVALID',
    );
  });

  it('rejects invalid phone numbers without echoing them', async () => {
    const r = await call(
      'createOrder',
      await orderInput({ customer: { name: 'Test Customer', mobile: '0112345678', whatsapp: '0770000001' } }),
    );
    expectError(r, 'INVALID_ARGUMENT', 'VALIDATION');
    expect(r.error?.details?.fields).toContain('customer.mobile');
    expect(JSON.stringify(r.error)).not.toContain('0112345678');
  });

  it('rejects missing consent', async () => {
    expectError(
      await call('createOrder', await orderInput({ consent: false })),
      'INVALID_ARGUMENT',
      'VALIDATION',
    );
  });

  it('rejects calls without App Check', async () => {
    const r = await call('createOrder', await orderInput(), { appCheck: false });
    expect(r.error?.status).toBe('UNAUTHENTICATED');
    expect((await db.collection('orders').get()).size).toBe(0);
  });
});
