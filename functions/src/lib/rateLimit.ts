import { Timestamp, db } from './admin.js';
import { fail } from './errors.js';
import { hmac } from './hash.js';

export interface RateLimitSpec {
  scope: string;
  id: string;
  limit: number;
  windowSec: number;
}

function keyFor(spec: RateLimitSpec, now: number) {
  const windowStart = Math.floor(now / 1000 / spec.windowSec) * spec.windowSec;
  return { key: hmac(`${spec.scope}|${spec.id}|${windowStart}`), windowStart };
}

/** Increment the counter and throw RATE_LIMITED when the limit is exceeded. */
export async function enforceRateLimit(spec: RateLimitSpec, now = Date.now()): Promise<void> {
  const count = await hit(spec, now);
  if (count > spec.limit) fail('resource-exhausted', 'RATE_LIMITED');
}

/** Increment and return the new count. */
export async function hit(spec: RateLimitSpec, now = Date.now()): Promise<number> {
  const { key, windowStart } = keyFor(spec, now);
  const ref = db().collection('rate_limits').doc(key);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = ((snap.exists ? (snap.get('count') as number) : 0) || 0) + 1;
    tx.set(ref, {
      count,
      windowStart: Timestamp.fromMillis(windowStart * 1000),
      expiresAt: Timestamp.fromMillis((windowStart + spec.windowSec + 3600) * 1000),
    });
    return count;
  });
}

/** Read the current count without incrementing. */
export async function peek(spec: Omit<RateLimitSpec, 'limit'>, now = Date.now()): Promise<number> {
  const { key } = keyFor({ ...spec, limit: 0 }, now);
  const snap = await db().collection('rate_limits').doc(key).get();
  return snap.exists ? ((snap.get('count') as number) ?? 0) : 0;
}
