import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, corsOrigins } from '../options.js';
import { addOrderNoteSchema } from '../shared/schemas.js';
import type { AuditEvent } from '../shared/types.js';
import { Timestamp, db } from '../lib/admin.js';
import { fail } from '../lib/errors.js';
import { parse, requireAdmin, requireAppCheck } from '../lib/guard.js';

export async function handleAddOrderNote(request: CallableRequest<unknown>) {
  requireAppCheck(request);
  const actor = requireAdmin(request);
  const input = parse(addOrderNoteSchema, request.data);
  const ref = db().collection('orders').doc(input.orderId);
  if (!(await ref.get()).exists) fail('not-found', 'NOT_FOUND');
  const event: AuditEvent = {
    type: 'note',
    at: Timestamp.now(),
    by: actor,
    from: null,
    to: null,
    note: input.note,
    meta: null,
  };
  await ref.collection('audit').add(event);
  return { ok: true };
}

export const addOrderNote = onCall({ ...ADMIN_CALLABLE, cors: corsOrigins() }, handleAddOrderNote);
