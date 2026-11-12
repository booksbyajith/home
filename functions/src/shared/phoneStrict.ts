import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile';
import { setIntlCheck } from './phone.js';

/**
 * Strict international numbers: a valid mobile number for the country code (Google's
 * libphonenumber rules for length and prefixes). Sri Lankan numbers are checked by
 * normaliseLkMobile, so +94 landlines are refused here.
 */
export function enableStrictPhones(): void {
  setIntlCheck((plus) => {
    const phone = parsePhoneNumberFromString(plus);
    if (!phone || !phone.isValid() || phone.country === 'LK') return null;
    return phone.number.slice(1);
  });
}

enableStrictPhones();
