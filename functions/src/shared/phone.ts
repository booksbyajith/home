export { maskPhone, last4 } from './mask.js';

const STRIP = /[\s\-.()]/g;

/** Normalise a Sri Lankan mobile number to 94XXXXXXXXX, or null if invalid. */
export function normaliseLkMobile(input: string): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(STRIP, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith('0094')) s = s.slice(2);
  if (s.startsWith('94') && s.length === 11) {
    /* already international */
  } else if (s.startsWith('0') && s.length === 10) s = '94' + s.slice(1);
  else if (s.length === 9) s = '94' + s;
  else return null;
  return /^947\d{8}$/.test(s) ? s : null;
}

/** Checks an international number written as "+digits"; returns digits without +, or null. */
export type IntlCheck = (plus: string) => string | null;

// Basic rule until the full phone rules are loaded (see phoneStrict.ts): 8-15 digits.
const basicIntl: IntlCheck = (plus) => {
  const digits = plus.slice(1);
  return /^\d{8,15}$/.test(digits) && !digits.startsWith('0') ? digits : null;
};
let intlCheck: IntlCheck = basicIntl;

/** Install the strict international check (phoneStrict.ts). */
export function setIntlCheck(check: IntlCheck): void {
  intlCheck = check;
}

/**
 * Normalise a WhatsApp number: a Sri Lankan mobile, or an international number written with +
 * and the country code. With phoneStrict.ts loaded (always on the server), international numbers
 * must be a valid mobile number for their country. Returns digits without the +.
 */
export function normaliseWhatsApp(input: string): string | null {
  const lk = normaliseLkMobile(input);
  if (lk) return lk;
  if (typeof input !== 'string') return null;
  const s = input.trim().replace(STRIP, '');
  if (!s.startsWith('+')) return null;
  return intlCheck(s);
}
