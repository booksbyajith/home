import { defineSecret, defineString } from 'firebase-functions/params';
import { REGION } from './shared/constants.js';

export { REGION };

export const SITE_URL = defineString('SITE_URL', { default: '' });
export const ALLOWED_ORIGINS = defineString('ALLOWED_ORIGINS', { default: '' });
export const STORAGE_BUCKET = defineString('STORAGE_BUCKET', { default: '' });

export const SMTP_HOST = defineSecret('SMTP_HOST');
export const SMTP_PORT = defineSecret('SMTP_PORT');
export const SMTP_USER = defineSecret('SMTP_USER');
export const SMTP_PASS = defineSecret('SMTP_PASS');
export const MAIL_FROM = defineSecret('MAIL_FROM');
export const TEAM_EMAILS = defineSecret('TEAM_EMAILS');
export const HASH_SALT = defineSecret('HASH_SALT');
export const TELEGRAM_BOT_TOKEN = defineSecret('TELEGRAM_BOT_TOKEN');
export const TELEGRAM_CHAT_ID = defineSecret('TELEGRAM_CHAT_ID');
export const WA_TOKEN = defineSecret('WA_TOKEN');
export const WA_PHONE_NUMBER_ID = defineSecret('WA_PHONE_NUMBER_ID');

export const SMTP_SECRETS = [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM];
export const ALL_SECRETS = [
  ...SMTP_SECRETS,
  TEAM_EMAILS,
  HASH_SALT,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  WA_TOKEN,
  WA_PHONE_NUMBER_ID,
];

export function isEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true';
}

/** An optional secret is off when empty or the literal "disabled". */
export function isSet(value: string | undefined | null): value is string {
  return !!value && value.trim() !== '' && value.trim().toLowerCase() !== 'disabled';
}

/**
 * CORS origins for callables, read once at load time from the deployed .env.
 * The emulator allows any origin. Protection does not rely on CORS: App Check and rules do.
 */
export function corsOrigins(): string[] | boolean {
  if (isEmulator()) return true;
  const list = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : true;
}

export const PUBLIC_CALLABLE = {
  region: REGION,
  invoker: 'public' as const,
  enforceAppCheck: true,
  maxInstances: 10,
  memory: '256MiB' as const,
} as const;

export const ADMIN_CALLABLE = {
  region: REGION,
  invoker: 'public' as const,
  enforceAppCheck: true,
  maxInstances: 10,
  memory: '256MiB' as const,
} as const;
