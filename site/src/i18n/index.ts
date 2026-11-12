import type { Lang } from '@shared/constants';
import { en } from './en';
import { si, type Dict, type I18nKey } from './si';

export type { Dict, I18nKey, Lang };
export const dicts: Record<Lang, Dict> = { si, en };

export function format(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (w, k: string) => (vars[k] === undefined ? w : String(vars[k])));
}

export function t(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  return format(dicts[lang][key] ?? dicts.si[key], vars);
}

/** A translator bound to one language. */
export function useT(lang: Lang) {
  return (key: I18nKey, vars?: Record<string, string | number>) => t(lang, key, vars);
}

/** Subset of a dictionary for passing to islands. */
export function pick<K extends I18nKey>(lang: Lang, prefixes: string[]): Partial<Record<K, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dicts[lang])) if (prefixes.some((p) => k.startsWith(p))) out[k] = v;
  return out as Partial<Record<K, string>>;
}

export function formatDate(lang: Lang, d: Date | string | number, opts?: Intl.DateTimeFormatOptions): string {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat(lang === 'si' ? 'si-LK' : 'en-GB', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...opts,
  }).format(date);
}
