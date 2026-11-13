import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, corsOrigins } from '../options.js';
import { getSlipUrlSchema } from '../shared/schemas.js';
import type { AuditEvent, OrderDoc } from '../shared/types.js';
import { Timestamp, bucket, db } from '../lib/admin.js';
import { fail } from '../lib/errors.js';
import { errorCode, log } from '../lib/log.js';
import { parse, requireAdmin, requireAppCheck } from '../lib/guard.js';

const TTL_MS = 5 * 60 * 1000;

export async function handleGetSlipUrl(request: CallableRequest<unknown>) {
  requireAppCheck(request);
  const actor = requireAdmin(request);
  const input = parse(getSlipUrlSchema, request.data);
  const ref = db().collection('orders').doc(input.orderId);
  const order = (await ref.get()).data() as OrderDoc | undefined;
  if (!order?.slip) fail('not-found', 'NOT_FOUND');

  // The slip itself is returned (as a data: URL; slips are at most 5 MB). A signed Cloud Storage
  // link would need the functions' service account to hold the Token Creator role, which a fresh
  // project doesn't grant: without it the request failed and the admin's button did nothing.
  const file = bucket().file(order.slip.path);
  let buf: Buffer;
  try {
    [buf] = await file.download();
  } catch (err) {
    log.error('slip download failed', { code: errorCode(err), path: order.slip.path });
    fail('internal', 'SLIP_UNREADABLE', {
      reason: `download: ${String((err as Error)?.message ?? err).slice(0, 300)}`,
    });
  }
  const url = `data:${order.slip.contentType};base64,${buf.toString('base64')}`;
  const expiresAt = Date.now() + TTL_MS;
  const event: AuditEvent = {
    type: 'slip_view',
    at: Timestamp.now(),
    by: actor,
    from: null,
    to: null,
    note: null,
    meta: null,
  };
  await ref.collection('audit').add(event);
  return { url, contentType: order.slip.contentType, expiresAt };
}

/**
 * Admin-only, so an unexpected failure returns its reason (a storage or runtime message, never
 * customer data) instead of a bare "internal" error, which can't be diagnosed from the panel.
 */
async function handleGetSlipUrlWithReason(request: CallableRequest<unknown>) {
  try {
    return await handleGetSlipUrl(request);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    log.error('getSlipUrl failed', { code: errorCode(err) });
    const reason = String((err as Error)?.message ?? err).slice(0, 300);
    fail('internal', 'SLIP_UNREADABLE', { reason });
  }
}

export const getSlipUrl = onCall(
  { ...ADMIN_CALLABLE, memory: '512MiB', cors: corsOrigins() },
  handleGetSlipUrlWithReason,
);
