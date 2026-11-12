import { logger } from 'firebase-functions';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const DIGITS = /\d{7,}/g;

/** Remove email addresses and long digit runs (phone numbers, account numbers). */
export function redact(s: string): string {
  return s.replace(EMAIL, '[email]').replace(DIGITS, '[digits]');
}

type Fields = Record<string, string | number | boolean | null | undefined>;

function clean(fields?: Fields): Fields | undefined {
  if (!fields) return undefined;
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) out[k] = typeof v === 'string' ? redact(v) : v;
  return out;
}

export const log = {
  info: (msg: string, fields?: Fields) => logger.info(redact(msg), clean(fields)),
  warn: (msg: string, fields?: Fields) => logger.warn(redact(msg), clean(fields)),
  error: (msg: string, fields?: Fields) => logger.error(redact(msg), clean(fields)),
};

export function errorCode(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; name?: unknown };
    if (typeof e.code === 'string' || typeof e.code === 'number') return String(e.code);
    if (typeof e.name === 'string') return e.name;
  }
  return 'unknown';
}

export function errorMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  return redact(m).slice(0, 300);
}
