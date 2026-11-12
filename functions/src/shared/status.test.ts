import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  TRANSITIONS,
  canTransition,
  customerEmailFor,
  isTerminal,
  releasesStock,
  requiredFields,
  reservesStock,
  templateKeyFor,
} from './status.js';
import type { OrderStatus } from './types.js';

const allowed: Record<OrderStatus, OrderStatus[]> = {
  pending_verification: ['acknowledged', 'rejected', 'cancelled'],
  acknowledged: ['payment_verified', 'rejected', 'cancelled'],
  payment_verified: ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
  delivered: [],
  rejected: ['pending_verification'],
  cancelled: [],
};

describe('state machine', () => {
  const pairs = ORDER_STATUSES.flatMap((from) => ORDER_STATUSES.map((to) => [from, to] as const));
  it('has 49 pairs', () => expect(pairs).toHaveLength(49));
  it.each(pairs)('%s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(allowed[from].includes(to));
  });
  it('table matches spec', () => expect(TRANSITIONS).toEqual(allowed));
  it('terminal states', () => {
    expect(isTerminal('delivered')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('rejected')).toBe(false);
  });
});

describe('transition rules', () => {
  it('required fields', () => {
    expect(requiredFields('dispatched')).toEqual(['courier', 'trackingNo']);
    expect(requiredFields('rejected')).toEqual(['reason']);
    expect(requiredFields('cancelled')).toEqual([]);
    expect(requiredFields('acknowledged')).toEqual([]);
  });
  it('stock flags', () => {
    expect(releasesStock('rejected')).toBe(true);
    expect(releasesStock('cancelled')).toBe(true);
    expect(releasesStock('delivered')).toBe(false);
    expect(reservesStock('rejected', 'pending_verification')).toBe(true);
    expect(reservesStock('pending_verification', 'acknowledged')).toBe(false);
  });
  it('template keys', () => {
    expect(templateKeyFor('acknowledged')).toBe('acknowledged');
    expect(templateKeyFor('dispatched')).toBe('dispatched');
    expect(templateKeyFor('delivered')).toBeNull();
    expect(templateKeyFor('cancelled')).toBeNull();
  });
  it('customer emails', () => {
    expect(ORDER_STATUSES.filter(customerEmailFor)).toEqual(['payment_verified', 'dispatched', 'rejected']);
  });
});
