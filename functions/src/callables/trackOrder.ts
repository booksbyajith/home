import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { HASH_SALT, PUBLIC_CALLABLE, corsOrigins } from '../options.js';
import { trackOrderSchema } from '../shared/schemas.js';
import type { OrderDoc, OrderStatus } from '../shared/types.js';
import { Timestamp, db } from '../lib/admin.js';
import { fail } from '../lib/errors.js';
import { clientIp, parse, requireAppCheck } from '../lib/guard.js';
import { enforceRateLimit, hit, peek } from '../lib/rateLimit.js';

export interface TrackOrderResult {
  orderId: string;
  status: OrderStatus;
  timeline: { status: OrderStatus; at: number }[];
  courier: string | null;
  trackingNo: string | null;
  trackingUrl: string | null;
}

const FAIL_WINDOW = 3600;
const FAIL_LIMIT = 5;

const toMillis = (t: unknown) => (t instanceof Timestamp ? t.toMillis() : 0);

export async function handleTrackOrder(request: CallableRequest<unknown>): Promise<TrackOrderResult> {
  requireAppCheck(request);
  const input = parse(trackOrderSchema, request.data);
  await enforceRateLimit({ scope: 'track-ip', id: clientIp(request), limit: 30, windowSec: 600 });

  const failSpec = { scope: 'track-fail', id: input.orderId, windowSec: FAIL_WINDOW };
  if ((await peek(failSpec)) >= FAIL_LIMIT) fail('resource-exhausted', 'LOCKED');

  const snap = await db().collection('orders').doc(input.orderId).get();
  const order = snap.data() as OrderDoc | undefined;
  if (!order || order.phoneLast4 !== input.phoneLast4) {
    const n = await hit({ ...failSpec, limit: FAIL_LIMIT });
    if (n >= FAIL_LIMIT + 1) fail('resource-exhausted', 'LOCKED');
    fail('not-found', 'NOT_FOUND');
  }

  return {
    orderId: order.orderId,
    status: order.status,
    timeline: order.statusHistory.map((h) => ({ status: h.status, at: toMillis(h.at) })),
    courier: order.dispatch?.courier ?? null,
    trackingNo: order.dispatch?.trackingNo ?? null,
    trackingUrl: order.dispatch?.trackingUrl ?? null,
  };
}

export const trackOrder = onCall(
  { ...PUBLIC_CALLABLE, cors: corsOrigins(), secrets: [HASH_SALT] },
  handleTrackOrder,
);
