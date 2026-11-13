import { beforeEach, describe, expect, it } from 'vitest';
import { adminAuth, adminToken, call, db, resetAll, signIn, userToken } from '../helpers/emulator.js';
import { CUSTOMER, orderInput } from '../helpers/fixtures.js';

async function staffToken(): Promise<string> {
  const u = await adminAuth.createUser({ email: 'packer@example.com', password: 'password-123' });
  await adminAuth.setCustomUserClaims(u.uid, { staff: true });
  return signIn('packer@example.com', 'password-123');
}

async function verifiedOrder(admin: string): Promise<string> {
  const orderId = (await call('createOrder', await orderInput())).result.orderId;
  for (const to of ['acknowledged', 'payment_verified'])
    expect((await call('updateOrderStatus', { orderId, to }, { idToken: admin })).error).toBeUndefined();
  return orderId;
}

let admin: string;
beforeEach(async () => {
  await resetAll();
  admin = await adminToken();
});

describe('packing staff', () => {
  it('see only verified orders, with what a label needs', async () => {
    const verified = await verifiedOrder(admin);
    await call(
      'createOrder',
      await orderInput({ customer: { ...CUSTOMER, mobile: '0770000009', whatsapp: '0770000009' } }),
    );
    const staff = await staffToken();
    const r = await call('staffOrders', {}, { idToken: staff });
    expect(r.error).toBeUndefined();
    expect(r.result.orders.map((o: { orderId: string }) => o.orderId)).toEqual([verified]);
    const o = r.result.orders[0];
    expect(o.name).toBeTruthy();
    expect(o.addressLines.length).toBeGreaterThan(1);
    expect(o.phone).toMatch(/^0\d{9}$/);
    expect(o).not.toHaveProperty('email');
  });

  it('may mark a verified order packed, and nothing else', async () => {
    const orderId = await verifiedOrder(admin);
    const staff = await staffToken();
    expect(
      (await call('updateOrderStatus', { orderId, to: 'cancelled' }, { idToken: staff })).error?.status,
    ).toBe('PERMISSION_DENIED');
    expect(
      (await call('updateOrderStatus', { orderId, to: 'packed' }, { idToken: staff })).error,
    ).toBeUndefined();
    expect((await db.doc(`orders/${orderId}`).get()).data()!.status).toBe('packed');
    // Already packed: a second scan is refused, not repeated.
    expect(
      (await call('updateOrderStatus', { orderId, to: 'packed' }, { idToken: staff })).error?.status,
    ).toBe('FAILED_PRECONDITION');
    // Admin tools stay closed to staff.
    expect((await call('getSlipUrl', { orderId }, { idToken: staff })).error?.status).toBe(
      'PERMISSION_DENIED',
    );
  });

  it('is closed to ordinary accounts', async () => {
    expect((await call('staffOrders', {}, { idToken: await userToken() })).error?.status).toBe(
      'PERMISSION_DENIED',
    );
    expect((await call('staffOrders', {})).error?.status).toBe('PERMISSION_DENIED');
  });
});
