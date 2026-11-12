import { mergePrivateConfig, mergePublicConfig } from '../shared/defaults.js';
import type { PrivateConfig, PublicConfig } from '../shared/types.js';
import { db } from './admin.js';

export async function getPublicConfig(): Promise<PublicConfig> {
  const snap = await db().doc('config/public').get();
  return mergePublicConfig(snap.data() as Partial<PublicConfig> | undefined);
}

export async function getPrivateConfig(): Promise<PrivateConfig> {
  const snap = await db().doc('config/private').get();
  return mergePrivateConfig(snap.data() as Partial<PrivateConfig> | undefined);
}
