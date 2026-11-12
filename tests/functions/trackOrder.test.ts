import { beforeEach, describe, expect, it } from 'vitest';
import { call, resetAll } from '../helpers/emulator.js';
import { orderInput } from '../helpers/fixtures.js';

let orderId: string;
beforeEach(async () => {
  await resetAll();
  orderId = (await call('createOrder', await orderInput())).result.orderId;
});

describe('trackOrder', () => {
  it('returns only status, timeline and dispatch info', async () => {
    const r = await call('trackOrder', { orderId, phoneLast4: '0001' });
    expect(r.error).toBeUndefined();
    expect(Object.keys(r.result).sort()).toEqual([
      'courier',
      'orderId',
      'status',
      'timeline',
      'trackingNo',
      'trackingUrl',
    ]);
    expect(r.result.status).toBe('pending_verification');
    expect(r.result.timeline).toHaveLength(1);
    expect(r.result.timeline[0].at).toBeGreaterThan(0);
    const body = JSON.stringify(r.result);
    for (const pii of ['Test Customer', '94770000001', 'customer@example.com', 'Test Road', '00100'])
      expect(body).not.toContain(pii);
  });

  it('accepts a lower-case order id', async () => {
    expect(
      (await call('trackOrder', { orderId: orderId.toLowerCase(), phoneLast4: '0001' })).result?.orderId,
    ).toBe(orderId);
  });

  it('gives identical errors for wrong digits and unknown orders', async () => {
    const wrong = await call('trackOrder', { orderId, phoneLast4: '9999' });
    const unknown = await call('trackOrder', { orderId: 'AJ-2611-2222', phoneLast4: '0001' });
    expect(wrong.error).toEqual(unknown.error);
    expect(wrong.error?.status).toBe('NOT_FOUND');
  });

  it('requires App Check', async () => {
    expect(
      (await call('trackOrder', { orderId, phoneLast4: '0001' }, { appCheck: false })).error?.status,
    ).toBe('UNAUTHENTICATED');
  });
});
