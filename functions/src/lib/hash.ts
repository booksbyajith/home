import { createHash, createHmac } from 'node:crypto';
import { HASH_SALT } from '../options.js';

export function hmac(value: string): string {
  return createHmac('sha256', HASH_SALT.value()).update(value).digest('hex');
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
