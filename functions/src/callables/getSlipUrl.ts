import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, corsOrigins, isEmulator } from '../options.js';
import { getSlipUrlSchema } from '../shared/schemas.js';
import type { AuditEvent, OrderDoc } from '../shared/types.js';
import { Timestamp, bucket, db } from '../lib/admin.js';
import { fail } from '../lib/errors.js';
import { parse, requireAdmin, requireAppCheck } from '../lib/guard.js';

const TTL_MS = 5 * 60 * 1000;

export async function handleGetSlipUrl(request: CallableRequest<unknown>) {
  requireAppCheck(request);
  const actor = requireAdmin(request);
  const input = parse(getSlipUrlSchema, request.data);
  const ref = db().collection('orders').doc(input.orderId);
  const order = (await ref.get()).data() as OrderDoc | undefined;
  if (!order?.slip) fail('not-found', 'NOT_FOUND');

  const file = bucket().file(order.slip.path);
  const expiresAt = Date.now() + TTL_MS;
  let url: string;
  if (isEmulator()) {
    // The emulator has no signing key: return the bytes as a data URL instead.
    const [buf] = await file.download();
    url = `data:${order.slip.contentType};base64,${buf.toString('base64')}`;
  } else {
    [url] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: expiresAt });
  }
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

export const getSlipUrl = onCall(
  { ...ADMIN_CALLABLE, memory: '512MiB', cors: corsOrigins() },
  handleGetSlipUrl,
);
