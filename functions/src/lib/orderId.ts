import { randomInt } from 'node:crypto';
import { ORDER_ID_ALPHABET } from '../shared/constants.js';
import { colomboParts } from './time.js';

export function generateOrderId(now = new Date(), rand: (max: number) => number = randomInt): string {
  const { year, month } = colomboParts(now);
  const yymm = String(year % 100).padStart(2, '0') + String(month).padStart(2, '0');
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += ORDER_ID_ALPHABET[rand(ORDER_ID_ALPHABET.length)];
  return `AJ-${yymm}-${suffix}`;
}
