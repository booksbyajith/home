import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { HASH_SALT, PUBLIC_CALLABLE, corsOrigins } from '../options.js';
import { createOrderSchema } from '../shared/schemas.js';
import { computeTotals, orderability } from '../shared/pricing.js';
import { last4, maskPhone } from '../shared/mask.js';
import type { AuditEvent, BookDoc, OrderDoc, OrderItem } from '../shared/types.js';
import { Timestamp, bucket, db } from '../lib/admin.js';
import { getPublicConfig } from '../lib/config.js';
import { fail } from '../lib/errors.js';
import { clientIp, parse, requireAppCheck } from '../lib/guard.js';
import { log, errorCode } from '../lib/log.js';
import { generateOrderId } from '../lib/orderId.js';
import { enforceRateLimit } from '../lib/rateLimit.js';
import { buildSearchTokens } from '../lib/search.js';
import { decodeSlip } from '../lib/slip.js';

class IdCollision extends Error {}

export interface CreateOrderResult {
  orderId: string;
  createdAt: number;
  status: 'pending_verification';
  items: OrderItem[];
  totals: OrderDoc['totals'];
  phoneMasked: string;
  totalMismatch: boolean;
}

export async function handleCreateOrder(request: CallableRequest<unknown>): Promise<CreateOrderResult> {
  requireAppCheck(request);
  const input = parse(createOrderSchema, request.data);
  const ip = clientIp(request);

  await enforceRateLimit({ scope: 'order-phone-h', id: input.customer.mobile, limit: 3, windowSec: 3600 });
  await enforceRateLimit({ scope: 'order-phone-d', id: input.customer.mobile, limit: 10, windowSec: 86400 });
  await enforceRateLimit({ scope: 'order-ip-h', id: ip, limit: 10, windowSec: 3600 });

  const slip = decodeSlip(input.slip);
  const config = await getPublicConfig();
  if (!config.ordersOpen || !config.bank.accountNumber) fail('failed-precondition', 'ORDERS_CLOSED');

  for (let attempt = 0; attempt < 5; attempt++) {
    const now = Timestamp.now();
    const orderId = generateOrderId(now.toDate());
    const path = `slips/${orderId}/slip.${slip.ext}`;
    const file = bucket().file(path);
    await file.save(slip.buffer, {
      contentType: slip.contentType,
      resumable: false,
      metadata: { metadata: { orderId, sha256: slip.sha256 } },
    });

    try {
      const result = await db().runTransaction(async (tx) => {
        const orderRef = db().collection('orders').doc(orderId);
        const bookRefs = input.items.map((i) => db().collection('books').doc(i.slug));
        const [orderSnap, ...bookSnaps] = await Promise.all([
          tx.get(orderRef),
          ...bookRefs.map((r) => tx.get(r)),
        ]);
        if (orderSnap.exists) throw new IdCollision();

        const unavailable: string[] = [];
        const outOfStock: string[] = [];
        const items: OrderItem[] = [];
        input.items.forEach((line, idx) => {
          const snap = bookSnaps[idx];
          if (!snap.exists) return unavailable.push(line.slug);
          const book = snap.data() as BookDoc;
          const reason = orderability(book, line.qty);
          if (reason === 'insufficient_stock' || reason === 'not_in_stock') outOfStock.push(line.slug);
          else if (reason !== 'ok') unavailable.push(line.slug);
          else
            items.push({
              slug: line.slug,
              title: book.title,
              qty: line.qty,
              unitPriceLKR: book.priceLKR,
              lineTotalLKR: book.priceLKR * line.qty,
              preorder: !!book.preorder,
            });
        });
        if (unavailable.length) fail('failed-precondition', 'BOOK_UNAVAILABLE', { slugs: unavailable });
        if (outOfStock.length) fail('failed-precondition', 'OUT_OF_STOCK', { slugs: outOfStock });

        const totals = computeTotals({
          lines: items,
          districtId: input.address.districtId,
          signedCopy: input.signedCopy,
          config,
        });

        items.forEach((item, idx) => {
          if (item.preorder) return;
          const book = bookSnaps[idx].data() as BookDoc;
          tx.update(bookRefs[idx], { stock: book.stock - item.qty, updatedAt: now });
        });

        const customer = {
          name: input.customer.name,
          mobile: input.customer.mobile,
          whatsapp: input.customer.whatsapp,
          email: input.customer.email ?? null,
        };
        const order: OrderDoc = {
          orderId,
          status: 'pending_verification',
          lang: input.lang,
          createdAt: now,
          updatedAt: now,
          closedAt: null,
          anonymisedAt: null,
          customer,
          phoneLast4: last4(customer.mobile),
          address: {
            line1: input.address.line1,
            line2: input.address.line2 ?? null,
            city: input.address.city,
            districtId: input.address.districtId,
            postalCode: input.address.postalCode,
            country: input.address.country ?? null,
            landmark: input.address.landmark ?? null,
          },
          geo: input.geo
            ? {
                lat: input.geo.lat,
                lng: input.geo.lng,
                accuracyM: input.geo.accuracyM,
                capturedAt: Timestamp.fromMillis(input.geo.capturedAt),
              }
            : null,
          items,
          bookSlugs: items.map((i) => i.slug),
          totalQty: items.reduce((n, i) => n + i.qty, 0),
          totals,
          clientExpectedTotalLKR: input.expectedTotalLKR,
          totalMismatch: input.expectedTotalLKR !== totals.grandTotalLKR,
          signedCopy: input.signedCopy && config.signedCopy.enabled,
          dedicationNote: input.dedicationNote ?? null,
          slip: { path, contentType: slip.contentType, sizeBytes: slip.sizeBytes, sha256: slip.sha256 },
          statusHistory: [{ status: 'pending_verification', at: now }],
          dispatch: null,
          rejection: null,
          stockReserved: true,
          search: buildSearchTokens(orderId, customer),
        };
        tx.create(orderRef, order);
        const audit: AuditEvent = {
          type: 'status',
          at: now,
          by: null,
          from: null,
          to: 'pending_verification',
          note: null,
          meta: null,
        };
        tx.create(orderRef.collection('audit').doc(), audit);
        return order;
      });

      log.info('order created', {
        orderId,
        items: result.items.length,
        total: result.totals.grandTotalLKR,
        mismatch: result.totalMismatch,
      });
      return {
        orderId,
        createdAt: now.toMillis(),
        status: 'pending_verification',
        items: result.items,
        totals: result.totals,
        phoneMasked: maskPhone(result.customer.mobile),
        totalMismatch: result.totalMismatch,
      };
    } catch (err) {
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      if (err instanceof IdCollision) continue;
      if (!(err && typeof err === 'object' && 'httpErrorCode' in err))
        log.error('createOrder failed', { code: errorCode(err) });
      throw err;
    }
  }
  log.error('createOrder could not allocate an order id');
  return fail('internal', 'VALIDATION');
}

export const createOrder = onCall(
  { ...PUBLIC_CALLABLE, memory: '512MiB', timeoutSeconds: 60, cors: corsOrigins(), secrets: [HASH_SALT] },
  handleCreateOrder,
);
