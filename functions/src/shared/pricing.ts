import type { BookDoc, PublicConfig, Totals } from './types.js';

export type OrderabilityReason = 'ok' | 'not_direct' | 'no_price' | 'not_in_stock' | 'insufficient_stock';

export function orderability(
  book: Pick<BookDoc, 'saleMode' | 'priceLKR' | 'inStock' | 'preorder' | 'stock'>,
  qty = 1,
): OrderabilityReason {
  if (book.saleMode !== 'direct') return 'not_direct';
  if (!(book.priceLKR > 0)) return 'no_price';
  if (!book.inStock) return 'not_in_stock';
  if (!book.preorder && book.stock < qty) return 'insufficient_stock';
  return 'ok';
}

export function isOrderable(
  book: Pick<BookDoc, 'saleMode' | 'priceLKR' | 'inStock' | 'preorder' | 'stock'>,
  qty = 1,
): boolean {
  return orderability(book, qty) === 'ok';
}

export interface PricingLine {
  slug: string;
  qty: number;
  unitPriceLKR: number;
}

export function deliveryFee(
  config: Pick<PublicConfig, 'delivery'>,
  districtId: string,
  totalQty: number,
): number {
  if (totalQty <= 0) return 0;
  const d = config.delivery;
  const base = d.fees[districtId] ?? d.defaultFeeLKR;
  return Math.max(0, Math.round(base + d.perExtraCopyLKR * (totalQty - 1)));
}

export function computeTotals(input: {
  lines: PricingLine[];
  districtId: string;
  signedCopy: boolean;
  config: Pick<PublicConfig, 'delivery' | 'bundle' | 'signedCopy'>;
}): Totals {
  const { lines, config } = input;
  const totalQty = lines.reduce((n, l) => n + l.qty, 0);
  const subtotalLKR = lines.reduce((n, l) => n + l.qty * l.unitPriceLKR, 0);
  const b = config.bundle;
  const bundleDiscountLKR =
    b.enabled && totalQty >= b.minQty ? Math.floor((subtotalLKR * b.percentOff) / 100) : 0;
  const signedSurchargeLKR =
    config.signedCopy.enabled && input.signedCopy ? config.signedCopy.surchargeLKR * totalQty : 0;
  const deliveryFeeLKR = input.districtId ? deliveryFee(config, input.districtId, totalQty) : 0;
  return {
    subtotalLKR,
    bundleDiscountLKR,
    signedSurchargeLKR,
    deliveryFeeLKR,
    grandTotalLKR: subtotalLKR - bundleDiscountLKR + signedSurchargeLKR + deliveryFeeLKR,
  };
}

export function formatLKR(n: number): string {
  return 'Rs. ' + Math.round(n).toLocaleString('en-US');
}
