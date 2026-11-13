import type { Lang } from '@shared/constants';

/**
 * Guess the customer's country from the device's time zone (no network request, nothing
 * leaves the browser). Returns null in Sri Lanka or when the zone is not recognised.
 */
const PREFIX: [string, string][] = [
  ['Australia/', 'AU'],
  ['Pacific/Auckland', 'NZ'],
  ['Europe/London', 'GB'],
  ['Europe/Dublin', 'IE'],
  ['Europe/Rome', 'IT'],
  ['Europe/Paris', 'FR'],
  ['Europe/Berlin', 'DE'],
  ['Europe/Zurich', 'CH'],
  ['Europe/Amsterdam', 'NL'],
  ['Europe/Oslo', 'NO'],
  ['Europe/Stockholm', 'SE'],
  ['Europe/Copenhagen', 'DK'],
  ['Europe/Helsinki', 'FI'],
  ['Europe/Madrid', 'ES'],
  ['Europe/Vienna', 'AT'],
  ['Europe/Brussels', 'BE'],
  ['Europe/Athens', 'GR'],
  ['Europe/Warsaw', 'PL'],
  ['Europe/Cyprus', 'CY'],
  ['Asia/Nicosia', 'CY'],
  ['Asia/Dubai', 'AE'],
  ['Asia/Qatar', 'QA'],
  ['Asia/Riyadh', 'SA'],
  ['Asia/Kuwait', 'KW'],
  ['Asia/Muscat', 'OM'],
  ['Asia/Bahrain', 'BH'],
  ['Asia/Jerusalem', 'IL'],
  ['Asia/Tel_Aviv', 'IL'],
  ['Asia/Beirut', 'LB'],
  ['Asia/Amman', 'JO'],
  ['Asia/Kolkata', 'IN'],
  ['Asia/Calcutta', 'IN'],
  ['Indian/Maldives', 'MV'],
  ['Asia/Kathmandu', 'NP'],
  ['Asia/Dhaka', 'BD'],
  ['Asia/Karachi', 'PK'],
  ['Asia/Singapore', 'SG'],
  ['Asia/Kuala_Lumpur', 'MY'],
  ['Asia/Bangkok', 'TH'],
  ['Asia/Tokyo', 'JP'],
  ['Asia/Seoul', 'KR'],
  ['Asia/Shanghai', 'CN'],
  ['Asia/Hong_Kong', 'HK'],
  ['Asia/Taipei', 'TW'],
  ['America/Toronto', 'CA'],
  ['America/Vancouver', 'CA'],
  ['America/Edmonton', 'CA'],
  ['America/Winnipeg', 'CA'],
  ['America/Halifax', 'CA'],
  ['America/New_York', 'US'],
  ['America/Chicago', 'US'],
  ['America/Denver', 'US'],
  ['America/Phoenix', 'US'],
  ['America/Los_Angeles', 'US'],
  ['America/Anchorage', 'US'],
  ['Pacific/Honolulu', 'US'],
];

export function guessCountryCode(timeZone?: string): string | null {
  let tz = timeZone;
  try {
    tz ??= Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
  if (!tz || tz === 'Asia/Colombo') return null;
  return PREFIX.find(([p]) => tz === p || (p.endsWith('/') && tz.startsWith(p)))?.[1] ?? null;
}

/**
 * The guessed country's name, always in English (addresses and labels use one language).
 * `_lang` is kept for callers; the name no longer depends on it.
 */
export function guessCountryName(_lang: Lang, timeZone?: string): string | null {
  const code = guessCountryCode(timeZone);
  if (!code) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? null;
  } catch {
    return null;
  }
}
