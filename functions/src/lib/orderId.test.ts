import { describe, expect, it } from 'vitest';
import { ORDER_ID_REGEX } from '../shared/constants.js';
import { generateOrderId } from './orderId.js';

describe('generateOrderId', () => {
  it('matches the format', () => {
    for (let i = 0; i < 200; i++) expect(generateOrderId()).toMatch(ORDER_ID_REGEX);
  });
  it('uses the Asia/Colombo month', () => {
    // 2026-11-30 20:00 UTC is 2026-12-01 01:30 in Colombo.
    expect(generateOrderId(new Date('2026-11-30T20:00:00Z'), () => 0)).toBe('AJ-2612-2222');
    expect(generateOrderId(new Date('2026-11-12T05:00:00Z'), () => 29)).toBe('AJ-2611-ZZZZ');
  });
  it('never uses ambiguous characters', () => {
    const s = Array.from({ length: 500 }, () => generateOrderId().slice(8)).join('');
    expect(s).not.toMatch(/[01ILOU]/);
  });
});
