import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { ADMIN_CALLABLE, corsOrigins } from '../options.js';
import { updateSettingsSchema } from '../shared/schemas.js';
import { Timestamp, db } from '../lib/admin.js';
import { parse, requireAdmin, requireAppCheck } from '../lib/guard.js';
import { log } from '../lib/log.js';

export async function handleUpdateSettings(request: CallableRequest<unknown>) {
  requireAppCheck(request);
  const actor = requireAdmin(request);
  const input = parse(updateSettingsSchema, request.data);
  const stamp = { updatedAt: Timestamp.now(), updatedBy: actor.uid };
  const batch = db().batch();
  for (const which of ['public', 'private'] as const) {
    const data = input[which];
    if (!data || !Object.keys(data).length) continue;
    // mergeFields replaces each named top-level field wholesale (no stale nested keys).
    batch.set(
      db().doc(`config/${which}`),
      { ...data, ...stamp },
      { mergeFields: [...Object.keys(data), 'updatedAt', 'updatedBy'] },
    );
  }
  await batch.commit();
  log.info('settings updated', {
    public: Object.keys(input.public ?? {}).join(','),
    private: Object.keys(input.private ?? {}).join(','),
  });
  return { ok: true };
}

export const updateSettings = onCall({ ...ADMIN_CALLABLE, cors: corsOrigins() }, handleUpdateSettings);
