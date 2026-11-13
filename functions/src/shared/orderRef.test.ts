import { describe, expect, it } from 'vitest';
import { ORDER_ID_REGEX } from './constants.js';
import { isUsableRequestedId, newOrderId, orderIdFromRef, paymentRef } from './orderRef.js';
import { normaliseSearchQuery } from './search.js';

describe('order number as bank reference', () => {
  const nov = new Date('2026-11-13T08:00:00Z');
  it('makes valid order numbers for the Sri Lankan month', () => {
    const id = newOrderId(nov, () => 0);
    expect(id).toMatch(ORDER_ID_REGEX);
    expect(id.startsWith('AJ-2611-')).toBe(true);
  });
  it('turns the number into a reference with only letters and digits, and back', () => {
    expect(paymentRef('AJ-2611-K7Q3')).toBe('AJ2611K7Q3');
    expect(orderIdFromRef('aj2611k7q3')).toBe('AJ-2611-K7Q3');
    expect(orderIdFromRef('AJ2611K7Q')).toBeNull();
  });
  it('admin search accepts the reference', () => {
    expect(normaliseSearchQuery(' AJ2611K7Q3 ')).toBe('AJ-2611-K7Q3');
  });
  it('accepts this or last month only', () => {
    expect(isUsableRequestedId('AJ-2611-K7Q3', nov)).toBe(true);
    expect(isUsableRequestedId('AJ-2610-K7Q3', nov)).toBe(true);
    expect(isUsableRequestedId('AJ-2608-K7Q3', nov)).toBe(false);
    expect(isUsableRequestedId('AJ-2611-K7Q', nov)).toBe(false);
  });
});
