import { ORDER_STATUSES, type OrderStatus, type TemplateKey } from './types.js';

export { ORDER_STATUSES };
export type { OrderStatus };

export const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_verification: ['acknowledged', 'rejected', 'cancelled'],
  acknowledged: ['payment_verified', 'rejected', 'cancelled'],
  payment_verified: ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
  delivered: [],
  rejected: ['pending_verification'],
  cancelled: [],
};

export function isOrderStatus(s: unknown): s is OrderStatus {
  return typeof s === 'string' && (ORDER_STATUSES as readonly string[]).includes(s);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type TransitionField = 'courier' | 'trackingNo' | 'reason';

export function requiredFields(to: OrderStatus): TransitionField[] {
  if (to === 'dispatched') return ['courier', 'trackingNo'];
  if (to === 'rejected') return ['reason'];
  return [];
}

export function isTerminal(s: OrderStatus): boolean {
  return TRANSITIONS[s].length === 0;
}

/** Status closes the order (sets closedAt). */
export function isClosing(s: OrderStatus): boolean {
  return s === 'delivered' || s === 'rejected' || s === 'cancelled';
}

export function releasesStock(to: OrderStatus): boolean {
  return to === 'rejected' || to === 'cancelled';
}

export function reservesStock(from: OrderStatus, to: OrderStatus): boolean {
  return from === 'rejected' && to === 'pending_verification';
}

export function templateKeyFor(to: OrderStatus): Exclude<TemplateKey, 'back_in_stock'> | null {
  switch (to) {
    case 'acknowledged':
    case 'payment_verified':
    case 'dispatched':
    case 'rejected':
      return to;
    default:
      return null;
  }
}

export function customerEmailFor(to: OrderStatus): boolean {
  return to === 'payment_verified' || to === 'dispatched' || to === 'rejected';
}
