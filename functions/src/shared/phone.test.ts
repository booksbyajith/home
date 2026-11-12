import { describe, expect, it } from 'vitest';
import './phoneStrict.js';
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
    expect(normaliseWhatsApp('+44 7911 123456')).toBe('447911123456'));
  it('rejects international numbers without +', () => expect(normaliseWhatsApp('447911123456')).toBeNull());
  it('rejects too short numbers', () => expect(normaliseWhatsApp('+1234567')).toBeNull());
  it.each([
    ['+61 412 345 678', '61412345678'],
    ['+61 (0)412 345 678', '61412345678'],
    ['+971 50 123 4567', '971501234567'],
    ['+1 416 555 0199', '14165550199'],
  ])('accepts the mobile %s', (input, out) => expect(normaliseWhatsApp(input)).toBe(out));
  it.each([
    '+61 412 345', // too short for Australia
    '+61 412 345 6789', // too long
    '+61 2 9876 5432', // Australian landline
    '+44 20 7946 0958', // London landline
    '+999 1234 5678', // no such country code
  ])('rejects %s', (input) => expect(normaliseWhatsApp(input)).toBeNull());
});

describe('masking', () => {
  it('masks all but the last 4', () => expect(maskPhone('94771234567')).toBe('••• ••• 4567'));
  it('last4', () => expect(last4('94771234567')).toBe('4567'));
});
