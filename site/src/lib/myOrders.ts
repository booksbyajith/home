import type { Lang } from '@shared/constants';
import type { L10n, OrderStatus, Totals } from '@shared/types';
import { readJson, writeJson } from './storage';

const ORDERS_KEY = 'aj.myOrders.v1';
const RECEIPTS_KEY = 'aj.receipts.v1';
const MAX = 20;

export interface MyOrder {
  orderId: string;
  createdAt: number;
  titles: string[];
  totalLKR: number;
  phoneLast4: string;
  lang: Lang;
}

export interface ReceiptData {
  orderId: string;
  createdAt: number;
  lang: Lang;
  items: { title: L10n; qty: number; unitPriceLKR: number; lineTotalLKR: number }[];
  totals: Totals;
  phoneMasked: string;
  status: OrderStatus;
  totalMismatch: boolean;
  expectedTotalLKR: number;
  /** Delivery outside Sri Lanka: postage is agreed later. */
  overseas?: boolean;
  /** The customer's own name and delivery address (kept only on their device). */
  customerName?: string;
  addressLines?: string[];
}

export function myOrders(): MyOrder[] {
  return readJson<MyOrder[]>(ORDERS_KEY) ?? [];
}

export function addMyOrder(o: MyOrder): void {
  writeJson(ORDERS_KEY, [o, ...myOrders().filter((x) => x.orderId !== o.orderId)].slice(0, MAX));
}

export function removeMyOrder(orderId: string): void {
  writeJson(ORDERS_KEY, myOrders().filter((x) => x.orderId !== orderId));
  const r = readJson<Record<string, ReceiptData>>(RECEIPTS_KEY) ?? {};
  delete r[orderId];
  writeJson(RECEIPTS_KEY, r);
}

export function saveReceipt(r: ReceiptData): void {
  const all = readJson<Record<string, ReceiptData>>(RECEIPTS_KEY) ?? {};
  all[r.orderId] = r;
  const keep = Object.values(all)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX);
  writeJson(RECEIPTS_KEY, Object.fromEntries(keep.map((x) => [x.orderId, x])));
}

export function getReceipt(orderId: string): ReceiptData | null {
  return (readJson<Record<string, ReceiptData>>(RECEIPTS_KEY) ?? {})[orderId] ?? null;
}
