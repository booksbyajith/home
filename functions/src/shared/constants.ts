export const LANGS = ['si', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'si';
export const TIMEZONE = 'Asia/Colombo';
export const REGION = 'asia-south1';

export const SLIP_MAX_BYTES = 5 * 1024 * 1024;
export const SLIP_IMAGE_TARGET_BYTES = 1.5 * 1024 * 1024;
export const SLIP_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type SlipType = (typeof SLIP_TYPES)[number];
export const SLIP_EXT: Record<SlipType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const MAX_QTY_PER_BOOK = 20;
export const MAX_TOTAL_QTY = 50;
export const MAX_ORDER_LINES = 10;

export const ORDER_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ORDER_ID_REGEX = /^AJ-\d{4}-[2-9A-HJKMNP-TV-Z]{4}$/;
