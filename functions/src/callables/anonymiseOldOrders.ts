import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, corsOrigins } from '../options.js';
import { anonymiseSchema } from '../shared/schemas.js';
import type { AuditEvent, OrderDoc } from '../shared/types.js';
import { Timestamp, bucket, db } from '../lib/admin.js';
import { getPrivateConfig } from '../lib/config.js';
import { parse, requireAdmin, requireAppCheck } from '../lib/guard.js';
import { log } from '../lib/log.js';
import { monthsAgo } from '../lib/time.js';

const BATCH = 200;

export async function handleAnonymiseOldOrders(request: CallableRequest<unknown>) {
  requireAppCheck(request);
  const actor = requireAdmin(request);
  const { dryRun } = parse(anonymiseSchema, request.data);
  const months = (await getPrivateConfig()).retention.anonymiseAfterMonths;
  const cutoff = Timestamp.fromDate(monthsAgo(months));
  const snap = await db()
    .collection('orders')
    .where('anonymisedAt', '==', null)
    .where('closedAt', '<', cutoff)
    .orderBy('closedAt')
    .limit(BATCH)
    .get();
  if (dryRun)
    return { matched: snap.size, anonymised: 0, hasMore: snap.size === BATCH, cutoff: cutoff.toMillis() };

  let anonymised = 0;
  for (const doc of snap.docs) {
    const order = doc.data() as OrderDoc;
    if (order.slip?.path) await bucket().file(order.slip.path).delete({ ignoreNotFound: true });
    const notes = await doc.ref.collection('audit').where('type', '==', 'note').get();
    const now = Timestamp.now();
    const batch = db().batch();
    batch.update(doc.ref, {
      customer: { name: '[removed]', mobile: '', whatsapp: '', email: null },
      address: {
        line1: '',
        line2: null,
        city: '',
        districtId: order.address.districtId,
        postalCode: '',
        country: order.address.country ?? null,
        landmark: null,
      },
      geo: null,
      dedicationNote: null,
      slip: null,
      search: [order.orderId],
      anonymisedAt: now,
      updatedAt: now,
    });
    notes.docs.forEach((n) => batch.delete(n.ref));
    const event: AuditEvent = {
      type: 'anonymise',
      at: now,
      by: actor,
      from: null,
      to: null,
      note: null,
      meta: { months },
    };
    batch.create(doc.ref.collection('audit').doc(), event);
    await batch.commit();
    anonymised++;
  }
  log.info('orders anonymised', { anonymised, months });
  return { matched: snap.size, anonymised, hasMore: snap.size === BATCH, cutoff: cutoff.toMillis() };
}

export const anonymiseOldOrders = onCall(
  { ...ADMIN_CALLABLE, timeoutSeconds: 300, cors: corsOrigins() },
  handleAnonymiseOldOrders,
);
