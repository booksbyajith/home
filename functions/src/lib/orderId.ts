import { randomInt } from 'node:crypto';
import { newOrderId } from '../shared/orderRef.js';

export function generateOrderId(now = new Date(), rand: (max: number) => number = randomInt): string {
  return newOrderId(now, rand);
}
