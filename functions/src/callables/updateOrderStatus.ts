import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, corsOrigins } from '../options.js';
import { updateOrderStatusSchema } from '../shared/schemas.js';
import { canTransition, isClosing, releasesStock, requiredFields, reservesStock } from '../shared/status.js';
import { buildCourierTrackingUrl } from '../shared/templates.js';
import type { AuditEvent, BookDoc, OrderDoc, OrderStatus } from '../shared/types.js';
import { FieldValue, Timestamp, db } from '../lib/admin.js';
import { getPrivateConfig, getPublicConfig } from '../lib/config.js';
import { fail } from '../lib/errors.js';
import { parse, requireAdmin, requireAppCheck, requireStaff } from '../lib/guard.js';
import { log } from '../lib/log.js';
import { statusMessage } from '../lib/messages.js';

export interface UpdateOrderStatusResult {
  orderId: string;
  status: OrderStatus;
  waUrl: string | null;
  message: string | null;
}

export async function handleUpdateOrderStatus(
  request: CallableRequest<unknown>,
): Promise<UpdateOrderStatusResult> {
  requireAppCheck(request);
  // Packing staff may only mark verified orders as packed; everything else is for admins.
  const input = parse(updateOrderStatusSchema, request.data);
  const actor = input.to === 'packed' ? requireStaff(request) : requireAdmin(request);
  const missing = requiredFields(input.to).filter((f) => !input[f]);
  if (missing.length) fail('invalid-argument', 'MISSING_FIELDS', { fields: missing });
  const pub = await getPublicConfig();

  const order = await db().runTransaction(async (tx) => {
    const ref = db().collection('orders').doc(input.orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) fail('not-found', 'NOT_FOUND');
    const order = snap.data() as OrderDoc;
    const from = order.status;
    if (!canTransition(from, input.to)) fail('failed-precondition', 'INVALID_TRANSITION');

    const stockLines = order.items.filter((i) => !i.preorder);
    const bookRefs = stockLines.map((i) => db().collection('books').doc(i.slug));
    const bookSnaps = await Promise.all(bookRefs.map((r) => tx.get(r)));
    const now = Timestamp.now();
    const patch: Record<string, unknown> = { status: input.to, updatedAt: now };

    if (releasesStock(input.to) && order.stockReserved) {
      stockLines.forEach((line, idx) => {
        if (bookSnaps[idx].exists)
          tx.update(bookRefs[idx], { stock: FieldValue.increment(line.qty), updatedAt: now });
      });
      patch.stockReserved = false;
    }
    if (reservesStock(from, input.to) && !order.stockReserved) {
      const short = stockLines
        .filter((line, idx) => !bookSnaps[idx].exists || (bookSnaps[idx].data() as BookDoc).stock < line.qty)
        .map((l) => l.slug);
      if (short.length) fail('failed-precondition', 'OUT_OF_STOCK', { slugs: short });
      stockLines.forEach((line, idx) =>
        tx.update(bookRefs[idx], { stock: FieldValue.increment(-line.qty), updatedAt: now }),
      );
      patch.stockReserved = true;
    }

    patch.closedAt = isClosing(input.to) ? now : null;
    if (input.to === 'dispatched') {
      const courier = pub.couriers.find((c) => c.name.toLowerCase() === input.courier!.toLowerCase());
      patch.dispatch = {
        courier: input.courier!,
        trackingNo: input.trackingNo!,
        trackingUrl: buildCourierTrackingUrl(courier?.trackingUrlTemplate, input.trackingNo!),
        dispatchedAt: now,
      };
    }
    if (input.to === 'rejected') patch.rejection = { reason: input.reason!, at: now };
    if (input.to === 'pending_verification') patch.rejection = null;
    patch.statusHistory = FieldValue.arrayUnion({ status: input.to, at: now });

    const meta: Record<string, unknown> = {};
    if (input.courier) meta.courier = input.courier;
    if (input.trackingNo) meta.trackingNo = input.trackingNo;
    const audit: AuditEvent = {
      type: 'status',
      at: now,
      by: actor,
      from,
      to: input.to,
      note: input.reason ?? null,
      meta: Object.keys(meta).length ? meta : null,
    };
    tx.update(ref, patch);
    tx.create(ref.collection('audit').doc(), audit);
    return {
      ...order,
      ...patch,
      statusHistory: [...order.statusHistory, { status: input.to, at: now }],
    } as OrderDoc;
  });

  log.info('order status changed', { orderId: order.orderId, to: order.status });
  const msg = statusMessage(order, pub, await getPrivateConfig());
  return {
    orderId: order.orderId,
    status: order.status,
    waUrl: msg?.waUrl ?? null,
    message: msg?.message ?? null,
  };
}

export const updateOrderStatus = onCall({ ...ADMIN_CALLABLE, cors: corsOrigins() }, handleUpdateOrderStatus);
