import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { ALL_SECRETS, REGION } from '../options.js';
import type { AuditEvent, OrderDoc } from '../shared/types.js';
import { db } from '../lib/admin.js';
import { log } from '../lib/log.js';
import { notify } from '../notify/index.js';

export const onOrderAudit = onDocumentCreated(
  {
    document: 'orders/{orderId}/audit/{eventId}',
    region: REGION,
    secrets: ALL_SECRETS,
    retry: true,
    memory: '512MiB',
  },
  async (event) => {
    const audit = event.data?.data() as AuditEvent | undefined;
    if (!audit || audit.type !== 'status' || !audit.to) return;
    const { orderId, eventId } = event.params;
    const order = (await db().collection('orders').doc(orderId).get()).data() as OrderDoc | undefined;
    if (!order) return;
    const r = await notify(order, { eventId, from: audit.from, to: audit.to });
    log.info('notifications done', { orderId, to: audit.to, sent: r.sent, skipped: r.skipped });
  },
);
