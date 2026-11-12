import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, corsOrigins } from '../options.js';
import { adminUpdateRecordSchema } from '../shared/schemas.js';
import { Timestamp, db } from '../lib/admin.js';
import { fail } from '../lib/errors.js';
import { parse, requireAdmin, requireAppCheck } from '../lib/guard.js';

export async function handleAdminUpdateRecord(request: CallableRequest<unknown>) {
  requireAppCheck(request);
  requireAdmin(request);
  const { collection, id, action } = parse(adminUpdateRecordSchema, request.data);
  const ref = db().collection(collection).doc(id);
  if (!(await ref.get()).exists) fail('not-found', 'NOT_FOUND');
  if (action === 'delete') await ref.delete();
  else if (action === 'mark_notified') await ref.update({ notifiedAt: Timestamp.now() });
  else await ref.update({ handledAt: Timestamp.now() });
  return { ok: true };
}

export const adminUpdateRecord = onCall({ ...ADMIN_CALLABLE, cors: corsOrigins() }, handleAdminUpdateRecord);
