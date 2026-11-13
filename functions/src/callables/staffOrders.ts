import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, corsOrigins } from '../options.js';
import { displayPhone, regionLine } from '../shared/districts.js';
import type { Lang } from '../shared/constants.js';
import type { L10n, OrderDoc } from '../shared/types.js';
import { db, type Timestamp } from '../lib/admin.js';
import { requireAppCheck, requireStaff } from '../lib/guard.js';

export interface StaffOrder {
  orderId: string;
  status: 'payment_verified' | 'packed';
  verifiedAt: number;
  name: string;
  phone: string;
  /** International form for the SMS app, e.g. +94771234567. */
  smsNumber: string;
  lang: Lang;
  addressLines: string[];
  items: { title: L10n; qty: number }[];
  signedCopy: boolean;
  dedicationNote: string | null;
}

/**
 * The packing list for the staff page: orders whose payment the admin has verified (to pack)
 * and those already packed (waiting to be posted). Only what a postal label needs.
 */
export async function handleStaffOrders(
  request: CallableRequest<unknown>,
): Promise<{ orders: StaffOrder[] }> {
  requireAppCheck(request);
  requireStaff(request);
  const snap = await db()
    .collection('orders')
    .where('status', 'in', ['payment_verified', 'packed'])
    .limit(300)
    .get();
  const orders = snap.docs.map((d) => {
    const o = d.data() as OrderDoc;
    const verified = [...(o.statusHistory ?? [])].reverse().find((h) => h.status === 'payment_verified');
    const a = o.address;
    return {
      orderId: o.orderId,
      status: o.status as StaffOrder['status'],
      verifiedAt: ((verified?.at ?? o.updatedAt) as Timestamp).toMillis(),
      name: o.customer.name,
      phone: displayPhone(o.customer.mobile),
      smsNumber: `+${o.customer.mobile}`,
      lang: o.lang,
      addressLines: [a.line1, a.line2, a.city, regionLine(a, 'en')].filter((x): x is string => !!x),
      items: o.items.map((i) => ({ title: i.title, qty: i.qty })),
      signedCopy: !!o.signedCopy,
      dedicationNote: o.dedicationNote ?? null,
    };
  });
  orders.sort((x, y) => x.verifiedAt - y.verifiedAt);
  return { orders };
}

export const staffOrders = onCall({ ...ADMIN_CALLABLE, cors: corsOrigins() }, handleStaffOrders);
