import { ORDER_ID_ALPHABET, ORDER_ID_REGEX } from './constants.js';

/** "YYMM" for a date, in Sri Lanka time. */
export function colomboYymm(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    year: '2-digit',
    month: '2-digit',
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((o, p) => ((o[p.type] = p.value), o), {});
  return `${parts.year}${parts.month}`;
}

/** A new order number, AJ-YYMM-XXXX (used by the order form before payment and by the server). */
export function newOrderId(now: Date, rand: (max: number) => number): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += ORDER_ID_ALPHABET[rand(ORDER_ID_ALPHABET.length)];
  return `AJ-${colomboYymm(now)}-${suffix}`;
}

/** The bank-transfer reference for an order: the order number without dashes (AJ2611K7Q3). */
export function paymentRef(orderId: string): string {
  return orderId.replace(/-/g, '');
}

/** AJ2611K7Q3 (any case) -> AJ-2611-K7Q3, or null if it isn't a payment reference. */
export function orderIdFromRef(ref: string): string | null {
  const m = ref
    .trim()
    .toUpperCase()
    .match(/^AJ(\d{4})([0-9A-Z]{4})$/);
  if (!m) return null;
  const id = `AJ-${m[1]}-${m[2]}`;
  return ORDER_ID_REGEX.test(id) ? id : null;
}

/**
 * Whether an order number chosen by the order form can be used: well formed and from this month
 * or last month (a customer may pay on the 31st and submit on the 1st).
 */
export function isUsableRequestedId(id: string, now: Date): boolean {
  if (!ORDER_ID_REGEX.test(id)) return false;
  const yymm = id.slice(3, 7);
  const lastMonth = new Date(now.getTime() - 32 * 86_400_000);
  return yymm === colomboYymm(now) || yymm === colomboYymm(lastMonth);
}
