import type { Functions } from 'firebase/functions';
import type { I18nKey } from '../i18n/si';
import { env } from './env';
import { getFirebaseApp } from './firebaseApp';

let fnsPromise: Promise<Functions> | null = null;

async function functions(): Promise<Functions> {
  fnsPromise ??= (async () => {
    const [app, { getFunctions, connectFunctionsEmulator }] = await Promise.all([getFirebaseApp(), import('firebase/functions')]);
    const f = getFunctions(app, env.functionsRegion);
    if (__USE_EMULATORS__) connectFunctionsEmulator(f, '127.0.0.1', 5001);
    return f;
  })();
  return fnsPromise;
}

/** Call a callable Cloud Function. Firebase is loaded on first use. */
export async function call<Req, Res>(name: string, data: Req): Promise<Res> {
  const [f, { httpsCallable }] = await Promise.all([functions(), import('firebase/functions')]);
  const res = await httpsCallable<Req, Res>(f, name, { timeout: 70_000 })(data);
  return res.data;
}

export interface CallError {
  status: string;
  code: string | null;
  fields: string[];
  slugs: string[];
}

export function callError(err: unknown): CallError {
  const e = err as { code?: string; details?: { code?: string; fields?: string[]; slugs?: string[] } };
  return {
    status: (e?.code ?? 'unknown').replace(/^functions\//, ''),
    code: e?.details?.code ?? null,
    fields: e?.details?.fields ?? [],
    slugs: e?.details?.slugs ?? [],
  };
}

/** Map a callable error to a message key for the order form. */
export function orderErrorKey(err: unknown): I18nKey {
  const { code, status } = callError(err);
  switch (code) {
    case 'OUT_OF_STOCK':
      return 'order.error.outOfStock';
    case 'BOOK_UNAVAILABLE':
      return 'order.error.unavailable';
    case 'RATE_LIMITED':
      return 'order.error.rateLimited';
    case 'SLIP_INVALID':
    case 'SLIP_TOO_LARGE':
      return 'order.error.slipInvalid';
    case 'ORDERS_CLOSED':
      return 'order.notConfigured';
  }
  if (status === 'resource-exhausted') return 'order.error.rateLimited';
  return 'order.error.submit';
}

export function formErrorKey(err: unknown): I18nKey {
  const { code, status } = callError(err);
  if (code === 'RATE_LIMITED' || status === 'resource-exhausted') return 'form.error.rateLimited';
  return 'form.error.generic';
}
