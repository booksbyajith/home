export const ERROR_CODES = [
  'VALIDATION',
  'ORDERS_CLOSED',
  'BOOK_UNAVAILABLE',
  'OUT_OF_STOCK',
  'SLIP_INVALID',
  'SLIP_TOO_LARGE',
  'RATE_LIMITED',
  'NOT_FOUND',
  'LOCKED',
  'INVALID_TRANSITION',
  'MISSING_FIELDS',
  'NOT_ADMIN',
  'NOT_STAFF',
  'APP_CHECK',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorDetails {
  code: ErrorCode;
  fields?: string[];
  slugs?: string[];
}
