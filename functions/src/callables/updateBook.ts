import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, SMTP_SECRETS, corsOrigins } from '../options.js';
import { isOrderable } from '../shared/pricing.js';
import { updateBookSchema } from '../shared/schemas.js';
import type { BookDoc } from '../shared/types.js';
import { Timestamp, db } from '../lib/admin.js';
import { fail } from '../lib/errors.js';
import { parse, requireAdmin, requireAppCheck } from '../lib/guard.js';
import { log } from '../lib/log.js';
import { notifyBackInStock } from '../notify/backInStock.js';

export async function handleUpdateBook(request: CallableRequest<unknown>) {
  requireAppCheck(request);
  requireAdmin(request);
  const { slug, ...changes } = parse(updateBookSchema, request.data);
  const ref = db().collection('books').doc(slug);
  const snap = await ref.get();
  if (!snap.exists) fail('not-found', 'NOT_FOUND');
  const before = snap.data() as BookDoc;
  const after = { ...before, ...changes } as BookDoc;
  if (after.saleMode === 'direct' && !(after.priceLKR > 0))
    fail('invalid-argument', 'VALIDATION', { fields: ['priceLKR'] });
  if (after.saleMode === 'external' && !after.externalUrl)
    fail('invalid-argument', 'VALIDATION', { fields: ['externalUrl'] });

  await ref.update({ ...changes, updatedAt: Timestamp.now() });
  let alertsEmailed = 0;
  if (!isOrderable(before) && isOrderable(after)) alertsEmailed = await notifyBackInStock(slug);
  log.info('book updated', { slug, fields: Object.keys(changes).join(','), alertsEmailed });
  return { ok: true, alertsEmailed };
}

export const updateBook = onCall(
  { ...ADMIN_CALLABLE, cors: corsOrigins(), secrets: SMTP_SECRETS },
  handleUpdateBook,
);
