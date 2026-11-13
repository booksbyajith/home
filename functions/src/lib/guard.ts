import type { CallableRequest } from 'firebase-functions/v2/https';
import type { z } from 'zod';
import { fail } from './errors.js';

export function requireAppCheck(request: Pick<CallableRequest, 'app'>): void {
  if (!request.app) fail('failed-precondition', 'APP_CHECK');
}

export interface AdminActor {
  uid: string;
  email: string | null;
}

export function requireAdmin(request: Pick<CallableRequest, 'auth'>): AdminActor {
  const a = request.auth;
  if (!a || a.token?.admin !== true) fail('permission-denied', 'NOT_ADMIN');
  return { uid: a.uid, email: (a.token.email as string | undefined) ?? null };
}

/** Packing staff (the staff claim) or an admin. */
export function requireStaff(request: Pick<CallableRequest, 'auth'>): AdminActor {
  const a = request.auth;
  if (!a || (a.token?.staff !== true && a.token?.admin !== true)) fail('permission-denied', 'NOT_STAFF');
  return { uid: a.uid, email: (a.token.email as string | undefined) ?? null };
}

export function clientIp(request: Pick<CallableRequest, 'rawRequest'>): string {
  const r = request.rawRequest;
  const fwd = r?.headers?.['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return r?.ip || first || 'unknown';
}

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = [...new Set(r.error.issues.map((i) => i.path.join('.') || i.message))].slice(0, 20);
    fail('invalid-argument', 'VALIDATION', { fields });
  }
  return r.data;
}
