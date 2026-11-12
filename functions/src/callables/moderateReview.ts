import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, corsOrigins } from '../options.js';
import { moderateReviewSchema } from '../shared/schemas.js';
import { Timestamp, db } from '../lib/admin.js';
import { fail } from '../lib/errors.js';
import { parse, requireAdmin, requireAppCheck } from '../lib/guard.js';

export async function handleModerateReview(request: CallableRequest<unknown>) {
  requireAppCheck(request);
  const actor = requireAdmin(request);
  const { id, action } = parse(moderateReviewSchema, request.data);
  const subRef = db().collection('review_submissions').doc(id);
  const sub = (await subRef.get()).data();
  if (!sub) fail('not-found', 'NOT_FOUND');
  const publicRef = db().collection('books').doc(sub.slug).collection('reviews').doc(id);
  const now = Timestamp.now();
  const batch = db().batch();
  if (action === 'approve') {
    batch.set(publicRef, {
      displayName: sub.displayName,
      rating: sub.rating,
      text: sub.text,
      lang: sub.lang,
      approvedAt: now,
    });
  } else {
    batch.delete(publicRef);
  }
  batch.update(subRef, {
    status: action === 'approve' ? 'approved' : 'rejected',
    moderatedAt: now,
    moderatedBy: actor.uid,
  });
  await batch.commit();
  return { ok: true };
}

export const moderateReview = onCall({ ...ADMIN_CALLABLE, cors: corsOrigins() }, handleModerateReview);
