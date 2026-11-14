import { beforeEach, describe, expect, it } from 'vitest';
import { adminToken, call, db, resetAll, userToken } from '../helpers/emulator.js';
import { PORTUGUESE, orderInput } from '../helpers/fixtures.js';

let admin: string;
let orderId: string;

beforeEach(async () => {
  await resetAll();
  admin = await adminToken();
  orderId = (await call('createOrder', await orderInput({ items: [{ slug: PORTUGUESE, qty: 2 }] }))).result
    .orderId;
});

const move = (to: string, extra: Record<string, string> = {}, idToken = admin) =>
  call('updateOrderStatus', { orderId, to, ...extra }, { idToken });
const stock = async () => (await db.doc(`books/${PORTUGUESE}`).get()).get('stock');
const decode = (url: string) => decodeURIComponent(url.split('?text=')[1]);

describe('updateOrderStatus', () => {
  it('walks the full path to delivered with WhatsApp links', async () => {
    const ack = await move('acknowledged');
    expect(ack.error).toBeUndefined();
    expect(ack.result.waUrl.startsWith('https://wa.me/94770000001?text=')).toBe(true);
    // Order language is Sinhala.
    expect(decode(ack.result.waUrl)).toBe(
      `Test Customer, ලංකාවේ පෘතුගීසි සිටි යුගය (1505-1594) ඇණවුම් කිරීම ගැන ඔබට ස්තුතියි! 🙏 ඔබගේ ඇණවුම් අංකය ${orderId}. අපි ඔබගේ බැංකු තැන්පතුව ඉක්මනින් තහවුරු කර පොත සූදානම් කිරීම අරඹන්නෙමු.`,
    );
    expect((await move('payment_verified')).result.status).toBe('payment_verified');
    const d = await move('dispatched', { courier: 'Demo Courier', trackingNo: 'TRK123' });
    expect(d.error).toBeUndefined();
    const msg = decode(d.result.waUrl);
    expect(msg).toContain('Demo Courier');
    expect(msg).toContain('TRK123');
    expect(msg).toContain(`http://127.0.0.1:4321/booksbyajith/track/#${orderId}`);
    expect(msg).toContain('https://www.facebook.com/example');
    const del = await move('delivered');
    expect(del.result.waUrl).toBeNull();

    const order = (await db.doc(`orders/${orderId}`).get()).data()!;
    expect(order.status).toBe('delivered');
    expect(order.statusHistory.map((h: any) => h.status)).toEqual([
      'pending_verification',
      'acknowledged',
      'payment_verified',
      'dispatched',
      'delivered',
    ]);
    expect(order.dispatch).toMatchObject({
      courier: 'Demo Courier',
      trackingNo: 'TRK123',
      trackingUrl: 'https://courier.example.com/track?n=TRK123',
    });
    expect(order.closedAt).toBeTruthy();

    const track = await call('trackOrder', { orderId, phoneLast4: '0001' });
    expect(track.result).toMatchObject({
      status: 'delivered',
      courier: 'Demo Courier',
      trackingNo: 'TRK123',
    });
    expect(track.result.timeline).toHaveLength(5);
  });

  it('uses English templates for English orders', async () => {
    const en = (
      await call(
        'createOrder',
        await orderInput({
          lang: 'en',
          customer: { name: 'English Reader', mobile: '0770000003', whatsapp: '+447911123456' },
        }),
      )
    ).result.orderId;
    const r = await call('updateOrderStatus', { orderId: en, to: 'acknowledged' }, { idToken: admin });
    expect(r.result.waUrl.startsWith('https://wa.me/447911123456?text=')).toBe(true);
    expect(decode(r.result.waUrl)).toBe(
      `Thank you for ordering The Portuguese in Sri Lanka (1505–1594), English Reader! 🙏 Your order number is ${en}. We will verify your bank transfer shortly and start preparing your book.`,
    );
  });

  it('rejects every invalid transition', async () => {
    for (const to of ['payment_verified', 'dispatched', 'delivered', 'pending_verification']) {
      const r = await move(to, { courier: 'X', trackingNo: 'Y' });
      expect(r.error?.details?.code, to).toBe('INVALID_TRANSITION');
    }
    await move('cancelled');
    for (const to of ['acknowledged', 'pending_verification', 'delivered']) {
      expect((await move(to)).error?.details?.code).toBe('INVALID_TRANSITION');
    }
  });

  it('requires courier and tracking number to dispatch', async () => {
    await move('acknowledged');
    await move('payment_verified');
    const r = await move('dispatched', { courier: 'Demo Courier' });
    expect(r.error?.details?.code).toBe('MISSING_FIELDS');
    expect(r.error?.details?.fields).toEqual(['trackingNo']);
  });

  it('requires a reason to reject, and returns stock', async () => {
    expect(await stock()).toBe(98);
    expect((await move('rejected')).error?.details?.code).toBe('MISSING_FIELDS');
    const r = await move('rejected', { reason: 'Amount does not match' });
    expect(decode(r.result.waUrl)).toContain('Amount does not match');
    expect(await stock()).toBe(100);
    const order = (await db.doc(`orders/${orderId}`).get()).data()!;
    expect(order.rejection.reason).toBe('Amount does not match');
    expect(order.stockReserved).toBe(false);
  });

  it('reopen re-reserves stock; cancel returns it', async () => {
    await move('rejected', { reason: 'Unclear slip' });
    expect(await stock()).toBe(100);
    expect((await move('pending_verification')).error).toBeUndefined();
    expect(await stock()).toBe(98);
    expect((await db.doc(`orders/${orderId}`).get()).get('rejection')).toBeNull();
    await move('cancelled');
    expect(await stock()).toBe(100);
  });

  it('records the admin in the audit log', async () => {
    await move('acknowledged');
    const audit = await db.collection(`orders/${orderId}/audit`).where('to', '==', 'acknowledged').get();
    expect(audit.docs[0].get('by')).toMatchObject({ email: 'admin@example.com' });
    expect(audit.docs[0].get('from')).toBe('pending_verification');
  });

  it('rejects non-admins and anonymous callers', async () => {
    expect((await move('acknowledged', {}, await userToken())).error?.status).toBe('PERMISSION_DENIED');
    expect((await call('updateOrderStatus', { orderId, to: 'acknowledged' })).error?.status).toBe(
      'PERMISSION_DENIED',
    );
    expect((await db.doc(`orders/${orderId}`).get()).get('status')).toBe('pending_verification');
  });
});
