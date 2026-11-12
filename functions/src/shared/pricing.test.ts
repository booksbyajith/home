import { describe, expect, it } from 'vitest';
import { computeTotals, deliveryFee, isOrderable, orderability, formatLKR } from './pricing.js';

const config = {
  delivery: {
    fees: { colombo: 350, jaffna: 600 },
    defaultFeeLKR: 450,
    perExtraCopyLKR: 100,
    estimateDays: { min: 2, max: 4 },
  },
  bundle: { enabled: true, minQty: 2, percentOff: 10 },
  signedCopy: { enabled: true, surchargeLKR: 500 },
};

describe('computeTotals', () => {
  it('single book, Colombo', () => {
    expect(
      computeTotals({
        lines: [{ slug: 'a', qty: 1, unitPriceLKR: 4500 }],
        districtId: 'colombo',
        signedCopy: false,
        config,
      }),
    ).toEqual({
      subtotalLKR: 4500,
      bundleDiscountLKR: 0,
      signedSurchargeLKR: 0,
      deliveryFeeLKR: 350,
      grandTotalLKR: 4850,
    });
  });
  it('bundle discount, extra copy fee, default district fee', () => {
    const t = computeTotals({
      lines: [
        { slug: 'a', qty: 1, unitPriceLKR: 4500 },
        { slug: 'b', qty: 2, unitPriceLKR: 2555 },
      ],
      districtId: 'kandy',
      signedCopy: false,
      config,
    });
    expect(t.subtotalLKR).toBe(9610);
    expect(t.bundleDiscountLKR).toBe(961);
    expect(t.deliveryFeeLKR).toBe(450 + 200);
    expect(t.grandTotalLKR).toBe(9610 - 961 + 650);
  });
  it('bundle rounds down', () => {
    const t = computeTotals({
      lines: [{ slug: 'a', qty: 2, unitPriceLKR: 1005 }],
      districtId: 'colombo',
      signedCopy: false,
      config,
    });
    expect(t.bundleDiscountLKR).toBe(201);
  });
  it('bundle below threshold or disabled', () => {
    expect(
      computeTotals({
        lines: [{ slug: 'a', qty: 1, unitPriceLKR: 1000 }],
        districtId: 'colombo',
        signedCopy: false,
        config,
      }).bundleDiscountLKR,
    ).toBe(0);
    expect(
      computeTotals({
        lines: [{ slug: 'a', qty: 3, unitPriceLKR: 1000 }],
        districtId: 'colombo',
        signedCopy: false,
        config: { ...config, bundle: { ...config.bundle, enabled: false } },
      }).bundleDiscountLKR,
    ).toBe(0);
  });
  it('signed copy surcharge per copy, only when enabled', () => {
    expect(
      computeTotals({
        lines: [{ slug: 'a', qty: 2, unitPriceLKR: 1000 }],
        districtId: 'jaffna',
        signedCopy: true,
        config,
      }).signedSurchargeLKR,
    ).toBe(1000);
    expect(
      computeTotals({
        lines: [{ slug: 'a', qty: 2, unitPriceLKR: 1000 }],
        districtId: 'jaffna',
        signedCopy: true,
        config: { ...config, signedCopy: { enabled: false, surchargeLKR: 500 } },
      }).signedSurchargeLKR,
    ).toBe(0);
  });
  it('no district yet means no delivery fee', () => {
    expect(
      computeTotals({
        lines: [{ slug: 'a', qty: 1, unitPriceLKR: 1000 }],
        districtId: '',
        signedCopy: false,
        config,
      }).deliveryFeeLKR,
    ).toBe(0);
  });
});

describe('overseas delivery', () => {
  it('charges no delivery fee up front (postage is agreed later)', () => {
    expect(
      deliveryFee(
        {
          delivery: { fees: {}, defaultFeeLKR: 400, perExtraCopyLKR: 100, estimateDays: { min: 1, max: 3 } },
        },
        'overseas',
        3,
      ),
    ).toBe(0);
  });
});

describe('orderability', () => {
  const base = { saleMode: 'direct' as const, priceLKR: 4500, inStock: true, preorder: false, stock: 3 };
  it('direct with stock', () => expect(isOrderable(base, 3)).toBe(true));
  it('insufficient stock', () => expect(orderability(base, 4)).toBe('insufficient_stock'));
  it('external', () => expect(orderability({ ...base, saleMode: 'external' })).toBe('not_direct'));
  it('unavailable', () => expect(orderability({ ...base, saleMode: 'unavailable' })).toBe('not_direct'));
  it('zero price', () => expect(orderability({ ...base, priceLKR: 0 })).toBe('no_price'));
  it('switched off', () => expect(orderability({ ...base, inStock: false })).toBe('not_in_stock'));
  it('preorder ignores stock', () =>
    expect(isOrderable({ ...base, stock: 0, preorder: true }, 5)).toBe(true));
});

it('formatLKR', () => expect(formatLKR(4500)).toBe('Rs. 4,500'));
