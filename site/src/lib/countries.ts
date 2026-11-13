/** Countries for overseas delivery, by ISO code, named in English (Sri Lanka excluded). */
const CODES =
  'AE AF AL AM AO AR AT AU AZ BA BB BD BE BG BH BJ BN BO BR BS BT BW BY BZ CA CD CH CI CL CM CN CO CR CU CY CZ DE DJ DK DO DZ EC EE EG ER ES ET FI FJ FR GA GB GE GH GM GN GR GT GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KR KW KZ LA LB LR LS LT LU LV LY MA MD ME MG MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK PL PR PS PT PY QA RO RS RU RW SA SC SD SE SG SI SK SL SN SO SR SS SV SY SZ TD TG TH TJ TL TM TN TO TR TT TW TZ UA UG US UY UZ VE VN YE ZA ZM ZW'.split(
    ' ',
  );

let cache: string[] | null = null;

/** English country names, sorted. */
export function countryNames(): string[] {
  if (cache) return cache;
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  cache = CODES.map((c) => names.of(c) ?? c).sort((a, b) => a.localeCompare(b, 'en'));
  return cache;
}

/** English name for an ISO country code. */
export function countryName(code: string): string {
  return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
}
