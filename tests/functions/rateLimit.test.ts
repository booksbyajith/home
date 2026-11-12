import { beforeEach, describe, expect, it } from 'vitest';
import { call, db, resetAll } from '../helpers/emulator.js';
import { orderInput } from '../helpers/fixtures.js';

beforeEach(resetAll);

describe('rate limiting', () => {
  it('rejects the fourth order from one phone within an hour', async () => {
    for (let i = 0; i < 3; i++) expect((await call('createOrder', await orderInput())).error).toBeUndefined();
    const r = await call('createOrder', await orderInput());
    expect(r.error?.status).toBe('RESOURCE_EXHAUSTED');
    expect(r.error?.details?.code).toBe('RATE_LIMITED');
    // A different phone is still allowed.
    const other = await call(
      'createOrder',
      await orderInput({ customer: { name: 'Other Person', mobile: '0770000002', whatsapp: '0770000002' } }),
    );
    expect(other.error).toBeUndefined();
  });

  it('locks tracking after 5 wrong attempts, even for correct digits', async () => {
    const orderId = (await call('createOrder', await orderInput())).result.orderId;
    for (let i = 0; i < 5; i++)
      expect((await call('trackOrder', { orderId, phoneLast4: '9999' })).error?.status).toBe('NOT_FOUND');
    const locked = await call('trackOrder', { orderId, phoneLast4: '0001' });
    expect(locked.error?.status).toBe('RESOURCE_EXHAUSTED');
    expect(locked.error?.details?.code).toBe('LOCKED');
  });

  it('stores only hashed keys, never phone numbers or IPs', async () => {
    await call('createOrder', await orderInput());
    const snap = await db.collection('rate_limits').get();
    expect(snap.size).toBeGreaterThan(0);
    for (const d of snap.docs) {
      expect(d.id).toMatch(/^[0-9a-f]{64}$/);
      const s = JSON.stringify(d.data());
      expect(s).not.toContain('94770000001');
      expect(s).not.toContain('127.0.0.1');
      expect(d.get('expiresAt')).toBeTruthy();
    }
  });
});
