import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import type { ErrorCode, ErrorDetails } from '../shared/errors.js';

export function fail(status: FunctionsErrorCode, code: ErrorCode, extra?: Omit<ErrorDetails, 'code'>): never {
  throw new HttpsError(status, code, { code, ...extra });
}
