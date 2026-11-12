import { describe, expect, it } from 'vitest';
import { maskPhone, last4, normaliseLkMobile, normaliseWhatsApp } from './phone.js';

describe('normaliseLkMobile', () => {
  it.each([
    ['0771234567', '94771234567'],
    ['077 123 4567', '94771234567'],
    ['077-123-4567', '94771234567'],
    ['771234567', '94771234567'],
    ['94771234567', '94771234567'],
    ['+94771234567', '94771234567'],
    ['+94 77 123 4567', '94771234567'],
    ['0094771234567', '94771234567'],
    ['(077) 123.4567', '94771234567'],
  ])('%s -> %s', (input, out) => expect(normaliseLkMobile(input)).toBe(out));

  it.each([
    '0112345678',
    '01123456',
    '07712345678',
    'abc',
    '',
    '+1 555 123 4567',
    '9477123456',
    '0661234567',
  ])('rejects %s', (input) => expect(normaliseLkMobile(input)).toBeNull());
});

describe('normaliseWhatsApp', () => {
  it('accepts Sri Lankan mobiles', () => expect(normaliseWhatsApp('0771234567')).toBe('94771234567'));
  it('accepts international numbers with +', () =>
    expect(normaliseWhatsApp('+44 7700 900123')).toBe('447700900123'));
  it('rejects international numbers without +', () => expect(normaliseWhatsApp('447700900123')).toBeNull());
  it('rejects too short numbers', () => expect(normaliseWhatsApp('+1234567')).toBeNull());
});

describe('masking', () => {
  it('masks all but the last 4', () => expect(maskPhone('94771234567')).toBe('••• ••• 4567'));
  it('last4', () => expect(last4('94771234567')).toBe('4567'));
});
